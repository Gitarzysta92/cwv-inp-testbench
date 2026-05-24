import type { BrowserContext, Page } from '@playwright/test';
import { installBenchMocks } from '../fixtures/api-mock';
import { installSlowdownFromBenchEnv } from '../fixtures/bench-env-setup';

export type WarmupMode = 'cold' | 'warm_assets' | 'warm_session';

export function getWarmupMode(): WarmupMode {
  const m = (process.env.BENCH_WARMUP ?? 'cold').toLowerCase();
  if (m === 'warm_assets' || m === 'warm_session') return m;
  return 'cold';
}

/**
 * Cold: clear cookies + storage (default lab isolation).
 * warm_assets / warm_session: skip reset so HTTP cache / session can persist per policy.
 */
export async function prepareBenchPage(
  page: Page,
  context: BrowserContext,
): Promise<void> {
  await installBenchMocks(page);
  await installSlowdownFromBenchEnv(page);
  const mode = getWarmupMode();
  if (mode !== 'cold') return;
  await context.clearCookies();
  await page.addInitScript(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

/**
 * Cold: no-op (handled in prepareBenchPage).
 * warm_assets: preload primary URL once so bundles/assets populate HTTP cache.
 * warm_session: seed sessionStorage on first navigation.
 */
export async function warmupNavigation(
  page: Page,
  mode: WarmupMode,
  absoluteUrl: string,
): Promise<void> {
  if (mode === 'cold') return;

  if (mode === 'warm_assets') {
    await page.goto(absoluteUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('about:blank');
    return;
  }

  if (mode === 'warm_session') {
    await page.goto(absoluteUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      sessionStorage.setItem('bench-warm-session', '1');
    });
  }
}

export function scenarioUrl(path: string): string {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4200';
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
