import type { ObservationNetworkStats, Profile } from '../../../lab/types';
import type { ResolvedNetworkPolicy } from '../../essentials/network-policy';
import { CdpConnection } from './connection';
import { closeTarget, openPageTarget, type CdpTarget } from './targets';
import {
  applyDeviceProfile,
  applyNetworkPolicy,
  disableNetworkPolicy,
  enableNetworkPolicy,
  type NetworkPolicyHandle,
} from './network-policy';
import {
  attachResponseCacheRecorder,
  enableResponseCacheReplay,
  type ResponseCacheRecorder,
  type ResponseCacheReplay,
} from './response-cache';
import { prepareWarmup, warmupNavigation, type WarmupResult } from './warmup';

export type BrowserSessionOptions = {
  cdpUrl: string;
  policy: ResolvedNetworkPolicy;
  profile: Profile;
  appBaseUrl: string;
  cpuThrottlingRate?: number;
};

export type BrowserSession = {
  target: CdpTarget;
  warmup: WarmupResult;
  release: () => Promise<ObservationNetworkStats>;
};

async function waitForLoad(cdp: CdpConnection, timeoutMs = 30_000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cdp.off('Page.loadEventFired', onLoad);
      reject(new Error('Page.loadEventFired timeout'));
    }, timeoutMs);

    const onLoad = (): void => {
      clearTimeout(timer);
      cdp.off('Page.loadEventFired', onLoad);
      resolve();
    };

    cdp.on('Page.loadEventFired', onLoad);
  });
}

async function navigate(cdp: CdpConnection, url: string): Promise<void> {
  await cdp.send('Page.navigate', { url });
  await waitForLoad(cdp).catch(() => {});
}

function disabledNetworkStats(reason?: string): ObservationNetworkStats {
  return {
    policy: {
      blockedByPolicy: 0,
      blockedRequests: [],
    },
    runtimeCache: {
      enabled: false,
      mode: reason ? 'unavailable' : 'disabled',
      missPolicy: 'block',
      reason,
      capture: {
        seen: 0,
        stored: 0,
        skipped: 0,
        bodyReadFailed: 0,
        cacheEntries: 0,
      },
      replay: {
        totalPaused: 0,
        servedFromCache: 0,
        blockedCacheMisses: 0,
        continuedToNetwork: 0,
        fulfillFailures: 0,
        allHandledLocally: false,
        allServedFromCache: false,
      },
      cacheMisses: [],
      fulfillFailureMessages: [],
    },
  };
}

function validCpuThrottlingRate(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 1) {
    return undefined;
  }
  return Math.round(value * 100) / 100;
}

function networkStatsFromCache(
  recorder: ResponseCacheRecorder | undefined,
  replay: ResponseCacheReplay | undefined,
  policyHandle?: NetworkPolicyHandle,
): ObservationNetworkStats {
  if (!recorder || !replay) {
    return {
      ...disabledNetworkStats(),
      policy: {
        blockedByPolicy: policyHandle?.stats.blockedByPolicy ?? 0,
        blockedRequests: policyHandle?.stats.blockedRequests ?? [],
      },
    };
  }

  return {
    policy: {
      blockedByPolicy: policyHandle?.stats.blockedByPolicy ?? 0,
      blockedRequests: policyHandle?.stats.blockedRequests ?? [],
    },
    runtimeCache: {
      enabled: true,
      mode: 'replay',
      missPolicy: replay.missPolicy,
      capture: {
        seen: recorder.stats.seen,
        stored: recorder.stats.stored,
        skipped: recorder.stats.skipped,
        bodyReadFailed: recorder.stats.failed,
        cacheEntries: recorder.cache.size,
      },
      replay: {
        totalPaused: replay.stats.seen,
        servedFromCache: replay.stats.served,
        blockedCacheMisses: replay.stats.missed,
        continuedToNetwork: replay.stats.continued,
        fulfillFailures: replay.stats.fulfillFailed,
        allHandledLocally: replay.stats.continued === 0 && replay.stats.fulfillFailed === 0,
        allServedFromCache: replay.stats.missed === 0 && replay.stats.fulfillFailed === 0,
      },
      cacheMisses: replay.misses,
      fulfillFailureMessages: replay.fulfillFailureMessages,
    },
  };
}

/**
 * Prepare a browser step over raw CDP.
 * Keeps a CDP session open for the step lifetime so Fetch/Network policy stays active.
 */
export async function beginBrowserSession(options: BrowserSessionOptions): Promise<BrowserSession> {
  const target = await openPageTarget(options.cdpUrl, 'about:blank');
  const cdp = await CdpConnection.connect(target.webSocketDebuggerUrl);
  const cpuThrottlingRate = validCpuThrottlingRate(options.cpuThrottlingRate);

  let policyHandle: NetworkPolicyHandle | undefined;
  let runtimeCacheRecorder: ResponseCacheRecorder | undefined;
  let runtimeCacheReplay: ResponseCacheReplay | undefined;
  let networkStats: ObservationNetworkStats = disabledNetworkStats();
  let released = false;

  const release = async (): Promise<ObservationNetworkStats> => {
    if (released) {
      return networkStats;
    }
    released = true;
    networkStats = networkStatsFromCache(runtimeCacheRecorder, runtimeCacheReplay, policyHandle);
    await runtimeCacheReplay?.detach().catch(() => {});
    policyHandle?.detach();
    runtimeCacheRecorder?.detach();
    if (cpuThrottlingRate !== undefined) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    }
    await disableNetworkPolicy(cdp, options.policy).catch(() => {});
    cdp.close();
    await closeTarget(options.cdpUrl, target.id).catch(() => {});
    return networkStats;
  };

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Storage.enable').catch(() => {});
    if (cpuThrottlingRate !== undefined) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottlingRate });
    }

    await applyDeviceProfile(cdp, options.profile);
    await enableNetworkPolicy(cdp, options.policy);
    if (options.profile.network.browserCache === 'disabled') {
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    }
    policyHandle = applyNetworkPolicy(cdp, options.policy);

    await prepareWarmup(cdp, options.profile.warmup, options.appBaseUrl);
    const shouldReplayRuntimeCache =
      options.profile.network.runtimeNetworkCache !== 'disabled' && !options.policy.mockApi;
    if (shouldReplayRuntimeCache) {
      runtimeCacheRecorder = attachResponseCacheRecorder(cdp);
      await navigate(cdp, options.appBaseUrl.replace(/\/$/, ''));

      if (options.profile.warmup === 'cold') {
        await prepareWarmup(cdp, options.profile.warmup, options.appBaseUrl);
      }
    } else if (options.policy.mockApi) {
      networkStats = disabledNetworkStats('mock API policy already owns Fetch interception');
    }

    const warmup = await warmupNavigation(cdp, {
      mode: options.profile.warmup,
      appBaseUrl: options.appBaseUrl,
    });

    if (runtimeCacheRecorder) {
      await runtimeCacheRecorder.drain();
      runtimeCacheRecorder.detach();
      await navigate(cdp, 'about:blank');
      runtimeCacheReplay = await enableResponseCacheReplay(cdp, runtimeCacheRecorder.cache, {
        missPolicy: options.profile.network.runtimeCacheMissPolicy ?? 'block',
      });
      networkStats = networkStatsFromCache(runtimeCacheRecorder, runtimeCacheReplay, policyHandle);
    }

    return {
      target,
      warmup,
      release,
    };
  } catch (err) {
    await release();
    throw err;
  }
}
