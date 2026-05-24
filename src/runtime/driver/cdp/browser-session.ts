import type { Profile } from '../../../lab/types';
import type { ResolvedNetworkPolicy } from '../../network-policy';
import { CdpConnection } from './connection';
import { closeTarget, openPageTarget, type CdpTarget } from './targets';
import {
  applyDeviceProfile,
  applyNetworkPolicy,
  disableNetworkPolicy,
  enableNetworkPolicy,
  type NetworkPolicyHandle,
} from './network-policy';
import { prepareWarmup, warmupNavigation, type WarmupResult } from './warmup';

export type BrowserSessionOptions = {
  cdpUrl: string;
  policy: ResolvedNetworkPolicy;
  profile: Profile;
  appBaseUrl: string;
};

export type BrowserSession = {
  target: CdpTarget;
  warmup: WarmupResult;
  release: () => Promise<void>;
};

/**
 * Prepare a browser step over raw CDP.
 * Keeps a CDP session open for the step lifetime so Fetch/Network policy stays active.
 */
export async function beginBrowserSession(options: BrowserSessionOptions): Promise<BrowserSession> {
  const target = await openPageTarget(options.cdpUrl, 'about:blank');
  const cdp = await CdpConnection.connect(target.webSocketDebuggerUrl);

  let policyHandle: NetworkPolicyHandle | undefined;
  let released = false;

  const release = async (): Promise<void> => {
    if (released) {
      return;
    }
    released = true;
    policyHandle?.detach();
    await disableNetworkPolicy(cdp, options.policy).catch(() => {});
    cdp.close();
    await closeTarget(options.cdpUrl, target.id).catch(() => {});
  };

  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Storage.enable').catch(() => {});

    await applyDeviceProfile(cdp, options.profile);
    await enableNetworkPolicy(cdp, options.policy);
    policyHandle = applyNetworkPolicy(cdp, options.policy);

    await prepareWarmup(cdp, options.profile.warmup, options.appBaseUrl);
    const warmup = await warmupNavigation(cdp, {
      mode: options.profile.warmup,
      appBaseUrl: options.appBaseUrl,
    });

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
