import { expect, test } from '@playwright/test';
import type { Page } from 'playwright';
import {
  assertRuntimeCacheWarmup,
  connectPreparedPage,
  env,
  installWebVitals,
  readBrowserMetrics,
  readWarmupResult,
  toBenchMetrics,
  warmupMetaValues,
  writeInvocation,
  type ScenarioTiming,
  type VitalMetric,
} from './shared';

type ClickCandidate = {
  x: number;
  y: number;
  label: string;
};

async function findEuroMenuTrigger(page: Page): Promise<ClickCandidate> {
  const candidate = await page.evaluate(() => {
    const query =
      'button,a,[role="button"],[aria-haspopup],[aria-controls],[data-testid],[data-test]';
    const triggerPattern = /menu|kategorie|wszystkie|produkty|hamburger/i;
    const elements = Array.from(document.querySelectorAll(query)) as HTMLElement[];

    const rows = elements
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const label = [
          element.innerText,
          element.textContent,
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.getAttribute('id'),
          element.getAttribute('class'),
          element.getAttribute('data-testid'),
          element.getAttribute('data-test'),
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (
          rect.width < 16 ||
          rect.height < 16 ||
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.right < 0 ||
          rect.left > window.innerWidth ||
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          Number(style.opacity) === 0 ||
          !triggerPattern.test(label)
        ) {
          return undefined;
        }

        let score = 0;
        if (/menu/i.test(label)) score += 100;
        if (/kategorie/i.test(label)) score += 80;
        if (/hamburger/i.test(label)) score += 60;
        if (rect.top < 180) score += 30;
        if (rect.left < window.innerWidth * 0.5) score += 20;
        if (element.tagName === 'BUTTON') score += 10;

        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          label: label.slice(0, 180),
          score,
        };
      })
      .filter((row): row is { x: number; y: number; label: string; score: number } => !!row)
      .sort((a, b) => b.score - a.score);

    return rows[0];
  });

  if (!candidate) {
    throw new Error('Euro menu trigger not found');
  }

  return candidate;
}

async function exerciseEuroOpenMenu(page: Page, baseUrl: string): Promise<ScenarioTiming> {
  const startedAt = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1_000);

  const candidate = await findEuroMenuTrigger(page);
  const interactionStartedAt = Date.now();
  await page.mouse.click(candidate.x, candidate.y);

  await page.waitForFunction(
    () =>
      /Laptopy|Telewizory|Smartfony|AGD|Komputery|Kategorie/i.test(document.body.innerText) ||
      typeof (window as unknown as {
        __benchWebVitals?: { latest?: Record<string, VitalMetric> };
      }).__benchWebVitals?.latest?.['INP']?.value === 'number',
    undefined,
    { timeout: 7_500 },
  ).catch(() => {});
  await page.waitForTimeout(750);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `euro-open-menu:${candidate.label}`,
  };
}

test('euro open menu', async () => {
  const scenarioId = env('BENCH_SCENARIO_ID', 'scenario-euro-open-menu');
  const baseUrl = env('PLAYWRIGHT_BASE_URL', 'https://www.euro.com.pl/');
  const attached = await connectPreparedPage();
  const warmup = readWarmupResult();

  try {
    assertRuntimeCacheWarmup(warmup);
    await installWebVitals(attached.page);
    const timing = await exerciseEuroOpenMenu(attached.page, baseUrl);
    const snapshot = await readBrowserMetrics(attached.page);
    const { metrics, inpSource } = toBenchMetrics(snapshot, timing, warmup);

    writeInvocation('passed', {
      scenarioId,
      metrics,
      meta: {
        inpSource,
        browserConnectMode: env('BENCH_BROWSER_CONNECT_MODE', 'launch'),
        appBaseUrl: baseUrl,
        interactionLabel: timing.interactionLabel ?? scenarioId,
        ...warmupMetaValues(warmup),
      },
    });

    expect(metrics['inpMs']).toBeGreaterThanOrEqual(0);
    expect(metrics['wallClockMs']).toBeGreaterThan(0);
  } catch (err) {
    writeInvocation('failed', {
      scenarioId,
      metrics: {},
      meta: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  } finally {
    await attached.cleanup().catch(() => {});
  }
});
