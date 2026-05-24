import type { WarmupPolicy } from '../../../lab/types';
import type { CdpConnection } from './connection';

export type WarmupOptions = {
  mode: WarmupPolicy;
  appBaseUrl: string;
};

export async function prepareWarmup(cdp: CdpConnection, mode: WarmupPolicy, appBaseUrl: string): Promise<void> {
  if (mode !== 'cold') {
    return;
  }

  await cdp.send('Network.clearBrowserCookies');
  await cdp.send('Network.clearBrowserCache');

  const origin = new URL(appBaseUrl).origin;
  await cdp.send('Storage.clearDataForOrigin', {
    origin,
    storageTypes: 'cookies,local_storage,session_storage,cache_storage,indexeddb,service_workers',
  });

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

export async function warmupNavigation(cdp: CdpConnection, options: WarmupOptions): Promise<void> {
  const { mode, appBaseUrl } = options;
  const url = appBaseUrl.replace(/\/$/, '');

  if (mode === 'cold') {
    await navigate(cdp, 'about:blank');
    return;
  }

  if (mode === 'warm_assets') {
    await navigate(cdp, url);
    await new Promise((r) => setTimeout(r, 500));
    await navigate(cdp, 'about:blank');
    return;
  }

  if (mode === 'warm_session') {
    await navigate(cdp, url);
    await cdp.send('Runtime.evaluate', {
      expression: `sessionStorage.setItem('bench-warm-session', '1')`,
      awaitPromise: false,
    });
  }
}
