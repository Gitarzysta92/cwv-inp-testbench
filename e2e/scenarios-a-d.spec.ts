import { test, expect } from './fixtures/bench-test';
import {
  collectLabMetrics,
  readRecentEventTiming,
  readWebVitalsInp,
  settleWebVitalsInp,
} from './helpers/measurement';
import { attachBenchMetrics } from './helpers/bench-metrics';
import { benchmarkSlowdownMeta } from './fixtures/bench-env-setup';
import {
  getWarmupMode,
  prepareBenchPage,
  scenarioUrl,
  warmupNavigation,
} from './helpers/warmup';
import { isScenarioSelected } from './helpers/scenario-filter';

const THINK_MS = 80;
const SEARCH_TYPING_MS = 35;
const SEARCH_QUERY = 'telewizor samsung';

export const LAB_SCENARIO_IDS = {
  aFirstThumb: 'scenario-a-first-thumb',
  bFourthFilter: 'scenario-b-fourth-filter',
  cSearchTyping: 'scenario-c-search-typing',
  dCartPlus: 'scenario-d-cart-plus',
} as const;

test.describe('Lab scenarios A–D', () => {
  test.beforeEach(async ({ page, context }) => {
    await prepareBenchPage(page, context);
  });

  test('A — first product / gallery thumbnail', async ({ page }, testInfo) => {
    test.skip(!isScenarioSelected(LAB_SCENARIO_IDS.aFirstThumb), 'BENCH_SCENARIO_ID filter');
    const mode = getWarmupMode();
    await warmupNavigation(page, mode, scenarioUrl('/scenario/a'));
    await page.goto('/scenario/a', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('gallery-thumb-3')).toBeVisible();
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('gallery-thumb-3').click();
    await expect(page.getByTestId('main-image')).toBeVisible();
    const m = await collectLabMetrics(page);
    await attachBenchMetrics(testInfo, {
      scenarioId: LAB_SCENARIO_IDS.aFirstThumb,
      metrics: m,
      meta: {
        thinkMs: THINK_MS,
        warmup: mode,
        inpSource: 'web-vitals/onINP',
        ...benchmarkSlowdownMeta(),
      },
    });
  });

  test('B — category filters (measure 4th after 1–3)', async ({ page }, testInfo) => {
    test.skip(!isScenarioSelected(LAB_SCENARIO_IDS.bFourthFilter), 'BENCH_SCENARIO_ID filter');
    const mode = getWarmupMode();
    await warmupNavigation(page, mode, scenarioUrl('/scenario/b'));
    await page.goto('/scenario/b', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('go-category').click();
    await expect(page.getByTestId('scenario-b-category')).toBeVisible();
    await page.getByTestId('scroll-region').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('filter-1').click();
    await page.getByTestId('filter-2').click();
    await page.getByTestId('filter-3').click();
    await page.getByTestId('filter-4').click();
    await expect(page.getByTestId('filters-applied')).toContainText('4');
    const m = await collectLabMetrics(page);
    await attachBenchMetrics(testInfo, {
      scenarioId: LAB_SCENARIO_IDS.bFourthFilter,
      metrics: m,
      meta: {
        thinkMs: THINK_MS,
        warmup: mode,
        inpSource: 'web-vitals/onINP',
        ...benchmarkSlowdownMeta(),
      },
    });
  });

  test('C — search typing (Polish phrase)', async ({ page }, testInfo) => {
    test.skip(!isScenarioSelected(LAB_SCENARIO_IDS.cSearchTyping), 'BENCH_SCENARIO_ID filter');
    const mode = getWarmupMode();
    await warmupNavigation(page, mode, scenarioUrl('/scenario/c'));
    await page.goto('/scenario/c', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('search-input').click();
    const perKeyMax: number[] = [];
    for (const ch of SEARCH_QUERY) {
      await page.keyboard.type(ch, { delay: SEARCH_TYPING_MS });
      const ev = await readRecentEventTiming(page);
      const mx = ev.length ? Math.max(...ev.map((e) => e.duration)) : 0;
      perKeyMax.push(mx);
    }
    await expect(page.getByTestId('search-preview')).toContainText(SEARCH_QUERY);
    const eventTimingMaxMs = perKeyMax.length ? Math.max(...perKeyMax) : 0;
    await settleWebVitalsInp(page);
    const inp = await readWebVitalsInp(page);
    const metrics: Record<string, number> = {
      eventTimingMaxMs,
      searchTypingWallMs: SEARCH_QUERY.length * SEARCH_TYPING_MS,
    };
    if (inp != null && Number.isFinite(inp.value)) {
      metrics.inpMs = inp.value;
    }
    await attachBenchMetrics(testInfo, {
      scenarioId: LAB_SCENARIO_IDS.cSearchTyping,
      metrics,
      meta: {
        phrase: SEARCH_QUERY,
        perKeyMaxSampleCount: perKeyMax.length,
        warmup: mode,
        inpSource: 'web-vitals/onINP',
        ...benchmarkSlowdownMeta(),
      },
    });
  });

  test('D — cart quantity after journey', async ({ page }, testInfo) => {
    test.skip(!isScenarioSelected(LAB_SCENARIO_IDS.dCartPlus), 'BENCH_SCENARIO_ID filter');
    const mode = getWarmupMode();
    await warmupNavigation(page, mode, scenarioUrl('/scenario/d/browse'));
    await page.goto('/scenario/d/browse', { waitUntil: 'networkidle' });
    await page.waitForTimeout(THINK_MS);
    await page.getByTestId('add-first-product').click();
    await page.getByTestId('open-cart').click();
    await expect(page.getByTestId('scenario-d-cart')).toBeVisible();
    await page.getByTestId('cart-plus').click();
    await expect(page.getByTestId('cart-qty-display')).toContainText('2');
    const m = await collectLabMetrics(page);
    await attachBenchMetrics(testInfo, {
      scenarioId: LAB_SCENARIO_IDS.dCartPlus,
      metrics: m,
      meta: {
        thinkMs: THINK_MS,
        warmup: mode,
        inpSource: 'web-vitals/onINP',
        ...benchmarkSlowdownMeta(),
      },
    });
  });
});
