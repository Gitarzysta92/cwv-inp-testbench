import type { WarmupPolicy } from '../../../lab/types';
import type { CdpConnection } from './connection';

export type WarmupOptions = {
  mode: WarmupPolicy;
  appBaseUrl: string;
};

export type NavigationCacheStats = {
  requests: number;
  servedFromCache: number;
  encodedDataLength: number;
};

export type WarmupResult = {
  mode: WarmupPolicy;
  url: string;
  warmed: boolean;
  firstNavigation?: NavigationCacheStats;
  verificationNavigation?: NavigationCacheStats;
};

function emptyStats(): NavigationCacheStats {
  return {
    requests: 0,
    servedFromCache: 0,
    encodedDataLength: 0,
  };
}

export async function prepareWarmup(cdp: CdpConnection, mode: WarmupPolicy, appBaseUrl: string): Promise<void> {
  await cdp.send('Network.clearBrowserCookies');
  await cdp.send('Network.clearBrowserCache');

  const origin = new URL(appBaseUrl).origin;
  await cdp.send('Storage.clearDataForOrigin', {
    origin,
    storageTypes: 'cookies,local_storage,session_storage,cache_storage,indexeddb,service_workers',
  });

  if (mode !== 'cold') {
    return;
  }

  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}`,
  });
}

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

async function recordNavigationCacheStats(
  cdp: CdpConnection,
  url: string,
): Promise<NavigationCacheStats> {
  const requestIds = new Set<string>();
  const cacheIds = new Set<string>();
  const stats = emptyStats();

  const onRequestWillBeSent = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'];
    const request = params['request'] as { url?: string } | undefined;
    if (typeof requestId === 'string' && request?.url?.startsWith('http')) {
      requestIds.add(requestId);
    }
  };

  const onRequestServedFromCache = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'];
    if (typeof requestId === 'string') {
      cacheIds.add(requestId);
    }
  };

  const onResponseReceived = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'];
    const response = params['response'] as
      | {
          fromDiskCache?: boolean;
          fromPrefetchCache?: boolean;
          fromServiceWorker?: boolean;
        }
      | undefined;
    if (
      typeof requestId === 'string' &&
      (response?.fromDiskCache || response?.fromPrefetchCache || response?.fromServiceWorker)
    ) {
      cacheIds.add(requestId);
    }
  };

  const onLoadingFinished = (params: Record<string, unknown>): void => {
    const encodedDataLength = params['encodedDataLength'];
    if (typeof encodedDataLength === 'number' && Number.isFinite(encodedDataLength)) {
      stats.encodedDataLength += encodedDataLength;
    }
  };

  cdp.on('Network.requestWillBeSent', onRequestWillBeSent);
  cdp.on('Network.requestServedFromCache', onRequestServedFromCache);
  cdp.on('Network.responseReceived', onResponseReceived);
  cdp.on('Network.loadingFinished', onLoadingFinished);

  try {
    await navigate(cdp, url);
    await new Promise((r) => setTimeout(r, 750));
  } finally {
    cdp.off('Network.requestWillBeSent', onRequestWillBeSent);
    cdp.off('Network.requestServedFromCache', onRequestServedFromCache);
    cdp.off('Network.responseReceived', onResponseReceived);
    cdp.off('Network.loadingFinished', onLoadingFinished);
  }

  stats.requests = requestIds.size;
  stats.servedFromCache = [...cacheIds].filter((id) => requestIds.has(id)).length;
  return stats;
}

export async function warmupNavigation(cdp: CdpConnection, options: WarmupOptions): Promise<WarmupResult> {
  const { mode, appBaseUrl } = options;
  const url = appBaseUrl.replace(/\/$/, '');

  if (mode === 'cold') {
    await navigate(cdp, 'about:blank');
    return {
      mode,
      url,
      warmed: false,
    };
  }

  if (mode === 'warm_assets') {
    const firstNavigation = await recordNavigationCacheStats(cdp, url);
    await navigate(cdp, 'about:blank');
    const verificationNavigation = await recordNavigationCacheStats(cdp, url);
    await navigate(cdp, 'about:blank');
    return {
      mode,
      url,
      firstNavigation,
      verificationNavigation,
      warmed: verificationNavigation.servedFromCache > 0,
    };
  }

  if (mode === 'warm_session') {
    const firstNavigation = await recordNavigationCacheStats(cdp, url);
    await cdp.send('Runtime.evaluate', {
      expression: `sessionStorage.setItem('bench-warm-session', '1')`,
      awaitPromise: false,
    });
    return {
      mode,
      url,
      firstNavigation,
      warmed: true,
    };
  }

  return {
    mode,
    url,
    warmed: false,
  };
}
