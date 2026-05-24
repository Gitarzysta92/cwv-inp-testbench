import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __CWV_BENCH_SLOW_CLICK_BY_TESTID__?: Record<string, number>;
    __CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__?: Record<string, number>;
  }
}

export type TargetedSlowdownMaps = {
  clickByTestId?: Record<string, number>;
  keydownByTestId?: Record<string, number>;
};

/**
 * Sets per-interaction slowdown maps (see src/bench-slowdown.ts). Call before `goto` or use `addInitScript`.
 */
export async function applyTargetedSlowdown(
  page: Page,
  maps: TargetedSlowdownMaps,
): Promise<void> {
  await page.evaluate((m) => {
    if (m.clickByTestId) {
      window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__ = {
        ...window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__,
        ...m.clickByTestId,
      };
    }
    if (m.keydownByTestId) {
      window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__ = {
        ...window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__,
        ...m.keydownByTestId,
      };
    }
  }, maps);
}

/** Clears maps so the next full navigation starts clean unless URL query sets them. */
export async function clearTargetedSlowdown(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__ = undefined;
    window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__ = undefined;
  });
}
