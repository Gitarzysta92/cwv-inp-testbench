import { resolveBrowserApplianceUrl } from './prepare-env';

const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_MS = 500;

export type WaitForBrowserOptions = {
  cdpUrl: string;
  timeoutMs?: number;
};

/** Poll browser appliance CDP until /json/version responds. */
export async function waitForBrowserAppliance(
  options: WaitForBrowserOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = options.cdpUrl.replace(/\/$/, '');
  const versionUrl = `${base}/json/version`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(versionUrl, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error(`Browser appliance not ready at ${versionUrl} after ${timeoutMs}ms`);
}

export async function ensureBrowserAppliance(): Promise<string | undefined> {
  const cdpUrl = resolveBrowserApplianceUrl();
  if (!cdpUrl) {
    return undefined;
  }
  console.error(`Waiting for browser appliance at ${cdpUrl} …`);
  await waitForBrowserAppliance({ cdpUrl });
  return cdpUrl;
}
