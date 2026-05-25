import type { Profile } from '../lab/types';

export type BrowserConnectMode = 'launch' | 'cdp';

/** CDP when BROWSER_CDP_URL is set; otherwise Playwright launches locally. */
export function resolveBrowserConnect(): {
  mode: BrowserConnectMode;
  cdpUrl?: string;
} {
  const cdpUrl = process.env['BROWSER_CDP_URL']?.trim();
  if (cdpUrl) {
    return { mode: 'cdp', cdpUrl };
  }
  return { mode: 'launch' };
}

/** Env vars for browser/viewport — client layer. */
export function prepareClientEnv(profile: Profile): Record<string, string> {
  const browser = resolveBrowserConnect();
  const env: Record<string, string> = {
    BENCH_VIEWPORT_WIDTH: String(profile.device.width),
    BENCH_VIEWPORT_HEIGHT: String(profile.device.height),
    BENCH_LOCALE: profile.system.locale,
    BENCH_TIMEZONE_ID: profile.system.timezoneId,
    BENCH_BROWSER_CONNECT_MODE: browser.mode,
  };

  if (browser.cdpUrl) {
    env['BROWSER_CDP_URL'] = browser.cdpUrl;
    env['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1';
  }

  if (!profile.browser.headless) {
    env['BENCH_HEADED'] = '1';
  }

  return env;
}
