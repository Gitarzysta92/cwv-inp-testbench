import { test, expect } from '@playwright/test';
import { installBenchMocks } from './fixtures/api-mock';
import {
  benchmarkSlowdownMeta,
  installSlowdownFromBenchEnv,
} from './fixtures/bench-env-setup';
import { collectLabMetrics } from './helpers/measurement';
import { attachBenchMetrics } from './helpers/bench-metrics';

/** Fixed “think” delay between navigation and first interaction (document in reports). */
const THINK_MS = 80;
const TYPING_DELAY_MS = 25;

export const SCENARIO_IDS = {
  categoryFilter: 'category-filter',
  searchCart: 'search-cart',
} as const;

test.describe('bench scenarios (container + test-run layer POC)', () => {
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
    await installSlowdownFromBenchEnv(page);
  });

  test('category filter click + event-timing samples', async ({ page }, testInfo) => {
    await page.goto('/bench', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('filter-electronics').click();
    await expect(page.getByTestId('item-list').getByText('Kettle')).toHaveCount(0);
    const m = await collectLabMetrics(page);
    await attachBenchMetrics(testInfo, {
      scenarioId: SCENARIO_IDS.categoryFilter,
      metrics: m,
      meta: { thinkMs: THINK_MS, inpSource: 'web-vitals/onINP', ...benchmarkSlowdownMeta() },
    });
  });

  test('search typing cadence + cart actions', async ({ page }, testInfo) => {
    const t0 = Date.now();
    await page.goto('/bench', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(THINK_MS);
    const input = page.getByTestId('search-input');
    await input.click();
    await page.keyboard.type('ear', { delay: TYPING_DELAY_MS });
    await expect(page.getByTestId('item-list').getByText('Earbuds')).toBeVisible();
    await page.getByTestId('add-to-cart').click();
    await expect(page.getByTestId('cart-qty')).toContainText('1');
    await page.getByTestId('cart-plus').click();
    await expect(page.getByTestId('cart-qty')).toContainText('2');
    const wallClockMs = Date.now() - t0;
    const m = await collectLabMetrics(page);
    await attachBenchMetrics(testInfo, {
      scenarioId: SCENARIO_IDS.searchCart,
      metrics: { ...m, wallClockMs },
      meta: {
        thinkMs: THINK_MS,
        typingDelayMs: TYPING_DELAY_MS,
        inpSource: 'web-vitals/onINP',
        ...benchmarkSlowdownMeta(),
      },
    });
  });
});
