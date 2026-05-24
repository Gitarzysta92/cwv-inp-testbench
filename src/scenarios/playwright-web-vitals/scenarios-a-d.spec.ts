import * as fs from 'fs';
import * as path from 'path';
import { expect, test } from '@playwright/test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

type VitalMetric = {
  value: number;
  delta?: number;
  rating?: string;
};

type BrowserMetricSnapshot = {
  vitals: Record<string, VitalMetric>;
  eventTimingMaxMs: number;
  eventTimingCount: number;
};

type ScenarioTiming = {
  wallClockMs: number;
  searchTypingWallMs: number;
};

type BenchMetricsAttachment = {
  scenarioId: string;
  metrics: Record<string, number>;
  meta?: Record<string, string | number | boolean>;
};

const webVitalsPath = path.join(
  process.cwd(),
  'node_modules/web-vitals/dist/web-vitals.iife.js',
);

function env(name: string, fallback?: string): string {
  return process.env[name]?.trim() || fallback || '';
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function inpProbeDelayMs(): number {
  const raw = Number(process.env['BENCH_INP_PROBE_DELAY_MS'] ?? 180);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 180;
}

function maybeMetric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? roundMetric(value) : undefined;
}

function artifactPath(): string {
  const resultsDir = env('BENCH_RESULTS_DIR');
  const configId = env('BENCH_CONFIG_ID', 'default');
  const runIndex = env('BENCH_RUN_INDEX', '0');
  const invocationId = env('BENCH_INVOCATION_ID', 'local');

  if (!resultsDir) {
    throw new Error('BENCH_RESULTS_DIR is required for playwright-web-vitals artifacts');
  }

  return path.join(resultsDir, `${configId}-run${runIndex}-${invocationId}.json`);
}

function writeInvocation(status: string, metrics?: BenchMetricsAttachment): void {
  const outPath = artifactPath();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        schema: 'playwright-web-vitals-invocation/1',
        invocationId: env('BENCH_INVOCATION_ID', 'local'),
        scenarios: [
          {
            status,
            metrics,
          },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function pageTargetId(context: BrowserContext, page: Page): Promise<string | undefined> {
  const session = await context.newCDPSession(page);
  try {
    const info = (await session.send('Target.getTargetInfo')) as {
      targetInfo?: { targetId?: string };
    };
    return info.targetInfo?.targetId;
  } finally {
    await session.detach();
  }
}

async function connectPreparedPage(): Promise<{
  browser: Browser;
  page: Page;
  cleanup: () => Promise<void>;
}> {
  const cdpUrl = env('BROWSER_CDP_URL');
  const targetId = env('BROWSER_TARGET_ID');
  if (!cdpUrl) {
    const browser = await chromium.launch({
      headless: process.env['BENCH_HEADED'] !== '1',
    });
    const page = await browser.newPage({
      viewport: {
        width: Number(env('BENCH_VIEWPORT_WIDTH', '1280')),
        height: Number(env('BENCH_VIEWPORT_HEIGHT', '720')),
      },
      locale: 'en-US',
      timezoneId: 'UTC',
    });
    return { browser, page, cleanup: () => browser.close() };
  }

  const browser = await chromium.connectOverCDP(cdpUrl);
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (targetId) {
          const id = await pageTargetId(context, page);
          if (id !== targetId) {
            continue;
          }
        }
        await page.bringToFront().catch(() => {});
        return { browser, page, cleanup: async () => {} };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  await browser.close();
  throw new Error(`No Playwright page for prepared CDP target ${targetId || '<any>'}`);
}

async function installWebVitals(page: Page): Promise<void> {
  const webVitalsSource = fs.readFileSync(webVitalsPath, 'utf8');
  await page.addInitScript({
    content: `${webVitalsSource}
;(() => {
  const state = { latest: {}, history: [], eventTimingMaxMs: 0, eventTimingCount: 0 };
  Object.defineProperty(window, '__benchWebVitals', {
    value: state,
    configurable: true,
  });
  const record = (metric) => {
    const row = {
      name: metric.name,
      value: metric.value,
      delta: metric.delta,
      rating: metric.rating,
    };
    state.latest[metric.name] = row;
    state.history.push(row);
  };
  try {
    if (PerformanceObserver.supportedEntryTypes.includes('event')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (typeof entry.duration === 'number') {
            state.eventTimingCount += 1;
            state.eventTimingMaxMs = Math.max(state.eventTimingMaxMs, entry.duration);
          }
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 0 });
    }
  } catch (err) {
    state.eventTimingError = err && err.message ? err.message : String(err);
  }
  const vitalsApi =
    window.webVitals ||
    (typeof webVitals !== 'undefined' ? webVitals : undefined);
  if (vitalsApi) {
    window.webVitals = vitalsApi;
  }
  if (!vitalsApi) {
    state.error = 'window.webVitals missing';
    return;
  }
  vitalsApi.onCLS(record, { reportAllChanges: true });
  vitalsApi.onFCP(record, { reportAllChanges: true });
  vitalsApi.onINP(record, { reportAllChanges: true, durationThreshold: 0 });
  vitalsApi.onLCP(record, { reportAllChanges: true });
  vitalsApi.onTTFB(record, { reportAllChanges: true });
})();`,
  });
}

async function exerciseGoogleInpProbe(page: Page, baseUrl: string): Promise<ScenarioTiming> {
  const startedAt = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(500);

  const delayMs = inpProbeDelayMs();
  await page.evaluate((delay) => {
    const existing = document.getElementById('bench-inp-probe');
    existing?.remove();

    const button = document.createElement('button');
    button.id = 'bench-inp-probe';
    button.textContent = 'Bench INP probe';
    button.style.position = 'fixed';
    button.style.left = '24px';
    button.style.top = '24px';
    button.style.zIndex = '2147483647';
    button.style.padding = '12px 16px';
    button.style.background = '#111827';
    button.style.color = '#ffffff';
    button.style.border = '0';
    button.style.borderRadius = '6px';
    button.style.font = '14px sans-serif';
    button.addEventListener('click', () => {
      const end = performance.now() + delay;
      while (performance.now() < end) {
        // Intentional busy wait for a deterministic lab INP signal.
      }
      button.textContent = 'Bench INP probe done';
    });
    document.body.appendChild(button);
  }, delayMs);

  const interactionStartedAt = Date.now();
  await page.locator('#bench-inp-probe').click({ timeout: 10_000 });
  await page.waitForFunction(
    () =>
      typeof (window as unknown as {
        __benchWebVitals?: { latest?: Record<string, VitalMetric> };
      }).__benchWebVitals?.latest?.['INP']?.value === 'number',
    undefined,
    { timeout: 5_000 },
  ).catch(() => {});

  await page.waitForTimeout(500);
  return {
    wallClockMs: Date.now() - startedAt,
    searchTypingWallMs: Date.now() - interactionStartedAt,
  };
}

async function readBrowserMetrics(page: Page): Promise<BrowserMetricSnapshot> {
  return page.evaluate(() => {
    const state = (window as unknown as {
      __benchWebVitals?: {
        latest?: Record<string, VitalMetric>;
        eventTimingMaxMs?: number;
        eventTimingCount?: number;
      };
    }).__benchWebVitals;

    return {
      vitals: state?.latest ?? {},
      eventTimingMaxMs: state?.eventTimingMaxMs ?? 0,
      eventTimingCount: state?.eventTimingCount ?? 0,
    };
  });
}

function toBenchMetrics(snapshot: BrowserMetricSnapshot, timing: ScenarioTiming): {
  metrics: Record<string, number>;
  inpSource: string;
} {
  const metrics: Record<string, number> = {
    wallClockMs: roundMetric(timing.wallClockMs),
    interactionWallMs: roundMetric(timing.searchTypingWallMs),
    searchTypingWallMs: roundMetric(timing.searchTypingWallMs),
    eventTimingMaxMs: roundMetric(snapshot.eventTimingMaxMs),
    eventTimingCount: snapshot.eventTimingCount,
  };

  const inp = maybeMetric(snapshot.vitals['INP']?.value);
  if (inp !== undefined) {
    metrics['inpMs'] = inp;
  } else {
    metrics['inpMs'] = roundMetric(snapshot.eventTimingMaxMs);
  }

  const fcp = maybeMetric(snapshot.vitals['FCP']?.value);
  const lcp = maybeMetric(snapshot.vitals['LCP']?.value);
  const cls = maybeMetric(snapshot.vitals['CLS']?.value);
  const ttfb = maybeMetric(snapshot.vitals['TTFB']?.value);

  if (fcp !== undefined) metrics['fcpMs'] = fcp;
  if (lcp !== undefined) metrics['lcpMs'] = lcp;
  if (cls !== undefined) metrics['cls'] = cls;
  if (ttfb !== undefined) metrics['ttfbMs'] = ttfb;

  return {
    metrics,
    inpSource: inp !== undefined ? 'web-vitals/onINP' : 'event-timing/fallback',
  };
}

test('bench scenario', async () => {
  const scenarioId = env('BENCH_SCENARIO_ID', 'scenario-google-search-typing');
  const baseUrl = env('PLAYWRIGHT_BASE_URL', 'https://www.google.com');
  const attached = await connectPreparedPage();

  try {
    await installWebVitals(attached.page);
    const timing = await exerciseGoogleInpProbe(attached.page, baseUrl);
    const snapshot = await readBrowserMetrics(attached.page);
    const { metrics, inpSource } = toBenchMetrics(snapshot, timing);

    writeInvocation('passed', {
      scenarioId,
      metrics,
      meta: {
        inpSource,
        browserConnectMode: env('BENCH_BROWSER_CONNECT_MODE', 'launch'),
        appBaseUrl: baseUrl,
        interactionProbeDelayMs: inpProbeDelayMs(),
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
