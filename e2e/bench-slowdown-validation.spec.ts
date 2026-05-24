import { test, expect } from '@playwright/test';
import { installBenchMocks } from './fixtures/api-mock';
import {
  applyTargetedSlowdown,
  clearTargetedSlowdown,
} from './fixtures/targeted-slowdown';
import { collectLabMetrics } from './helpers/measurement';

const THINK_MS = 80;

/**
 * Proves targeted slowdown increases reported INP vs the same flow without delay.
 */
test.describe('Targeted interaction slowdown (sanity)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    });
    await installBenchMocks(page);
  });

  test('filter-electronics click: inpMs rises when that control is slowed', async ({
    page,
  }) => {
    test.skip(
      !!process.env.BENCH_SLOW_CLICK_JSON?.trim(),
      'manual baseline vs slowed — skipped when matrix injects BENCH_SLOW_CLICK_JSON',
    );
    await page.goto('/bench', { waitUntil: 'domcontentloaded' });
    await clearTargetedSlowdown(page);
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('filter-electronics').click();
    const baseline = await collectLabMetrics(page);
    const baseInp = baseline.inpMs ?? 0;

    await page.goto('/bench', { waitUntil: 'domcontentloaded' });
    await applyTargetedSlowdown(page, {
      clickByTestId: { 'filter-electronics': 120 },
    });
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('filter-electronics').click();
    const slowed = await collectLabMetrics(page);
    const slowInp = slowed.inpMs ?? 0;

    expect(
      slowInp,
      `expected INP to increase when filter-electronics has +120ms spin (baseline≈${baseInp}, slowed=${slowInp})`,
    ).toBeGreaterThanOrEqual(baseInp + 40);
  });
});
