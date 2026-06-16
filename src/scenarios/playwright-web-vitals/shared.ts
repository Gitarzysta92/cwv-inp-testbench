import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

export type VitalMetric = {
  value: number;
  delta?: number;
  rating?: string;
  id?: string;
  navigationType?: string;
  entries?: unknown[];
  attribution?: unknown;
};

export type BrowserMetricSnapshot = {
  vitals: Record<string, VitalMetric>;
  history: VitalMetric[];
  eventTimingMaxMs: number;
  eventTimingCount: number;
  eventTimingEntries: unknown[];
  browserEnvironment: Record<string, string | number | boolean>;
  navigationTiming: Record<string, string | number>;
};

export type ScenarioTiming = {
  scenarioDurationMs: number;
  interactionWallMs: number;
  interactionLabel?: string;
};

export type BenchMetricsAttachment = {
  scenarioId: string;
  metrics: Record<string, number>;
  meta?: Record<string, string | number | boolean>;
};

export type NavigationCacheStats = {
  requests: number;
  servedFromCache: number;
  encodedDataLength: number;
};

export type WarmupResult = {
  mode: string;
  url: string;
  warmed: boolean;
  firstNavigation?: NavigationCacheStats;
  verificationNavigation?: NavigationCacheStats;
};

const webVitalsAttributionPath = path.join(
  process.cwd(),
  'node_modules/web-vitals/dist/web-vitals.attribution.iife.js',
);
const webVitalsPath = fs.existsSync(webVitalsAttributionPath)
  ? webVitalsAttributionPath
  : path.join(process.cwd(), 'node_modules/web-vitals/dist/web-vitals.iife.js');

export function env(name: string, fallback?: string): string {
  return process.env[name]?.trim() || fallback || '';
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function maybeMetric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? roundMetric(value) : undefined;
}

export function inpProbeDelayMs(): number {
  const raw = Number(process.env['BENCH_INP_PROBE_DELAY_MS'] ?? 180);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 180;
}

export function readWarmupResult(): WarmupResult | undefined {
  const raw = env('BENCH_WARMUP_RESULT_JSON');
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as WarmupResult;
  } catch {
    return undefined;
  }
}

function warmupMetricValues(warmup: WarmupResult | undefined): Record<string, number> {
  if (!warmup) {
    return {};
  }

  return {
    warmupFirstRequests: warmup.firstNavigation?.requests ?? 0,
    warmupFirstServedFromCache: warmup.firstNavigation?.servedFromCache ?? 0,
    warmupVerificationRequests: warmup.verificationNavigation?.requests ?? 0,
    warmupVerificationServedFromCache: warmup.verificationNavigation?.servedFromCache ?? 0,
    warmupVerificationEncodedDataLength:
      warmup.verificationNavigation?.encodedDataLength ?? 0,
  };
}

export function warmupMetaValues(warmup: WarmupResult | undefined): Record<string, string | number | boolean> {
  if (!warmup) {
    return {
      warmupPresent: false,
    };
  }

  return {
    warmupPresent: true,
    warmupMode: warmup.mode,
    warmupWarmed: warmup.warmed,
    warmupUrl: warmup.url,
    warmupVerificationRequests: warmup.verificationNavigation?.requests ?? 0,
    warmupVerificationServedFromCache: warmup.verificationNavigation?.servedFromCache ?? 0,
  };
}

export function assertRuntimeCacheWarmup(warmup: WarmupResult | undefined): void {
  if (warmup?.mode !== 'warm_assets') {
    return;
  }
  const verification = warmup.verificationNavigation;
  if (!warmup.warmed || !verification || verification.servedFromCache < 1) {
    throw new Error(
      `runtime warm_assets did not verify cache usage: ${JSON.stringify(warmup)}`,
    );
  }
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

function safeArtifactName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, '-').replace(/^-|-$/g, '') || 'artifact';
}

function debugArtifactsDir(): string {
  const parsed = path.parse(artifactPath());
  return path.join(parsed.dir, `${parsed.name}-debug`);
}

export function debugArtifactsMeta(): Record<string, string | boolean> {
  return env('BENCH_DEBUG_ARTIFACTS') === '1'
    ? {
        debugArtifactsEnabled: true,
        debugArtifactsDir: debugArtifactsDir(),
      }
    : {
        debugArtifactsEnabled: false,
      };
}

export async function writeDebugScreenshot(
  page: Page,
  label: string,
): Promise<string | undefined> {
  if (env('BENCH_DEBUG_ARTIFACTS') !== '1') {
    return undefined;
  }

  const dir = debugArtifactsDir();
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${safeArtifactName(label)}.png`);
  await page.screenshot({ path: outPath, fullPage: false }).catch(() => undefined);
  return outPath;
}

export function writeInvocation(status: string, metrics?: BenchMetricsAttachment): void {
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

export async function connectPreparedPage(): Promise<{
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
      locale: env('BENCH_LOCALE', 'en-US'),
      timezoneId: env('BENCH_TIMEZONE_ID', 'UTC'),
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

export async function installWebVitals(page: Page): Promise<void> {
  const webVitalsSource = fs.readFileSync(webVitalsPath, 'utf8');
  await page.addInitScript({
    content: `${webVitalsSource}
;(() => {
  const round = (value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value * 100) / 100
      : undefined;
  const describeNode = (node) => {
    try {
      if (!node || node.nodeType !== 1) return '';
      const element = node;
      const id = element.id ? '#' + element.id : '';
      const classes = element.classList && element.classList.length
        ? '.' + Array.from(element.classList).slice(0, 4).join('.')
        : '';
      const attrs = [
        element.getAttribute('aria-label'),
        element.getAttribute('data-testid'),
        element.getAttribute('data-test'),
        element.getAttribute('ems-automation-id'),
        element.getAttribute('href'),
      ].filter(Boolean);
      return [element.tagName.toLowerCase() + id + classes, attrs.join('|')]
        .filter(Boolean)
        .join(' ')
        .slice(0, 180);
    } catch {
      return '';
    }
  };
  const serializeEntry = (entry) => {
    if (!entry) return {};
    return {
      name: entry.name || '',
      entryType: entry.entryType || '',
      startTime: round(entry.startTime),
      duration: round(entry.duration),
      interactionId: Number(entry.interactionId || 0),
      processingStart: round(entry.processingStart),
      processingEnd: round(entry.processingEnd),
      cancelable: !!entry.cancelable,
      target: describeNode(entry.target),
    };
  };
  const serializeAttribution = (attribution) => {
    if (!attribution) return undefined;
    return {
      interactionTarget: attribution.interactionTarget || '',
      interactionType: attribution.interactionType || '',
      interactionTime: round(attribution.interactionTime),
      nextPaintTime: round(attribution.nextPaintTime),
      inputDelay: round(attribution.inputDelay),
      processingDuration: round(attribution.processingDuration),
      presentationDelay: round(attribution.presentationDelay),
      loadState: attribution.loadState || '',
      processedEventEntries: Array.isArray(attribution.processedEventEntries)
        ? attribution.processedEventEntries.slice(0, 8).map(serializeEntry)
        : [],
    };
  };
  const serializeMetric = (metric) => ({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    id: metric.id,
    navigationType: metric.navigationType,
    entries: Array.isArray(metric.entries) ? metric.entries.slice(0, 8).map(serializeEntry) : [],
    attribution: serializeAttribution(metric.attribution),
  });
  const state = {
    latest: {},
    history: [],
    eventTimingMaxMs: 0,
    eventTimingCount: 0,
    eventTimingEntries: [],
  };
  Object.defineProperty(window, '__benchWebVitals', {
    value: state,
    configurable: true,
  });
  const record = (metric) => {
    const row = serializeMetric(metric);
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
            state.eventTimingEntries.push(serializeEntry(entry));
          }
        }
        state.eventTimingEntries = state.eventTimingEntries
          .sort((a, b) => (b.duration || 0) - (a.duration || 0))
          .slice(0, 25);
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

export async function readBrowserMetrics(page: Page): Promise<BrowserMetricSnapshot> {
  return page.evaluate(() => {
    const round = (value: number): number => Math.round(value * 100) / 100;
    const state = (window as unknown as {
      __benchWebVitals?: {
        latest?: Record<string, VitalMetric>;
        history?: VitalMetric[];
        eventTimingMaxMs?: number;
        eventTimingCount?: number;
        eventTimingEntries?: unknown[];
      };
    }).__benchWebVitals;
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    const navigationTiming: Record<string, string | number> = navigation
      ? {
          type: navigation.type,
          startTime: round(navigation.startTime),
          responseEnd: round(navigation.responseEnd),
          domContentLoadedEventEnd: round(navigation.domContentLoadedEventEnd),
          loadEventEnd: round(navigation.loadEventEnd),
          duration: round(navigation.duration),
        }
      : {};

    return {
      vitals: state?.latest ?? {},
      history: state?.history ?? [],
      eventTimingMaxMs: state?.eventTimingMaxMs ?? 0,
      eventTimingCount: state?.eventTimingCount ?? 0,
      eventTimingEntries: state?.eventTimingEntries ?? [],
      browserEnvironment: {
        userAgent: navigator.userAgent,
        webdriver: !!navigator.webdriver,
        hardwareConcurrency: navigator.hardwareConcurrency,
        devicePixelRatio: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      },
      navigationTiming,
    };
  });
}

export function toBenchMetrics(
  snapshot: BrowserMetricSnapshot,
  timing: ScenarioTiming,
  warmup?: WarmupResult,
): {
  metrics: Record<string, number>;
  inpSource: string;
} {
  const metrics: Record<string, number> = {
    scenarioDurationMs: roundMetric(timing.scenarioDurationMs),
    interactionWallMs: roundMetric(timing.interactionWallMs),
    eventTimingMaxMs: roundMetric(snapshot.eventTimingMaxMs),
    eventTimingCount: snapshot.eventTimingCount,
    ...warmupMetricValues(warmup),
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
