import * as fs from 'fs';
import * as path from 'path';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
  type Request,
  type Response,
} from 'playwright';

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
  resourceTimingEntries: unknown[];
  resourceTimingSummary: unknown[];
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

export type PageDiagnosticsCapture = {
  consoleMessages: Array<{
    type: string;
    text: string;
    elapsedMs: number;
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  }>;
  pageErrors: Array<{
    message: string;
    stack?: string;
    elapsedMs: number;
  }>;
  browserRuntimeErrors: Array<{
    type: string;
    at: number;
    message: string;
    filename?: string;
    lineNumber?: number;
    columnNumber?: number;
    reasonType?: string;
    reason?: string;
    stack?: string;
    state?: Record<string, string | number | boolean>;
  }>;
  failedRequests: Array<{
    url: string;
    method: string;
    resourceType: string;
    errorText: string;
    elapsedMs: number;
  }>;
  httpErrorResponses: Array<{
    url: string;
    method: string;
    resourceType: string;
    status: number;
    statusText: string;
    fromServiceWorker: boolean;
    elapsedMs: number;
  }>;
  responses: Array<{
    url: string;
    method: string;
    resourceType: string;
    status: number;
    statusText: string;
    fromServiceWorker: boolean;
    elapsedMs: number;
  }>;
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

export function webVitalsInpFlushTimeoutMs(): number {
  const raw = Number(process.env['BENCH_WEB_VITALS_INP_FLUSH_TIMEOUT_MS'] ?? 3_000);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 3_000;
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

function pushLimited<T>(rows: T[], row: T, limit: number): void {
  rows.push(row);
  if (rows.length > limit) {
    rows.splice(0, rows.length - limit);
  }
}

function elapsedSince(startedAt: number): number {
  return roundMetric(Date.now() - startedAt);
}

function consoleEntry(
  message: ConsoleMessage,
  startedAt: number,
): PageDiagnosticsCapture['consoleMessages'][number] {
  const location = message.location();
  return {
    type: message.type(),
    text: message.text().slice(0, 1_000),
    elapsedMs: elapsedSince(startedAt),
    url: location.url || undefined,
    lineNumber: location.lineNumber || undefined,
    columnNumber: location.columnNumber || undefined,
  };
}

function requestEntry(
  request: Request,
): Omit<PageDiagnosticsCapture['failedRequests'][number], 'errorText' | 'elapsedMs'> {
  return {
    url: request.url(),
    method: request.method(),
    resourceType: request.resourceType(),
  };
}

function responseEntry(
  response: Response,
  startedAt: number,
): PageDiagnosticsCapture['responses'][number] {
  const request = response.request();
  return {
    ...requestEntry(request),
    status: response.status(),
    statusText: response.statusText(),
    fromServiceWorker: response.fromServiceWorker(),
    elapsedMs: elapsedSince(startedAt),
  };
}

export async function installPageDiagnostics(page: Page): Promise<PageDiagnosticsCapture> {
  const startedAt = Date.now();
  const diagnostics: PageDiagnosticsCapture = {
    consoleMessages: [],
    pageErrors: [],
    browserRuntimeErrors: [],
    failedRequests: [],
    httpErrorResponses: [],
    responses: [],
  };

  await page.addInitScript({
    content: `(() => {
  const round = (value) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value * 100) / 100
      : 0;
  const serializeValue = (value) => {
    try {
      if (value instanceof Error) {
        return {
          message: value.message || '',
          stack: value.stack || '',
          reasonType: 'Error',
          reason: value.message || String(value),
        };
      }
      return {
        message: typeof value === 'string' ? value : String(value),
        reasonType: value === null ? 'null' : typeof value,
        reason: typeof value === 'string' ? value : JSON.stringify(value),
      };
    } catch {
      return {
        message: String(value),
        reasonType: typeof value,
        reason: String(value),
      };
    }
  };
  const state = () => {
    const global = window;
    const dataLayer = global.dataLayer;
    const zowieKeys = Object.keys(global)
      .filter((key) => /zowie|herochat|chat/i.test(key))
      .slice(0, 8)
      .join(',');
    return {
      url: location.href,
      readyState: document.readyState,
      hasDataLayer: Array.isArray(dataLayer),
      dataLayerLength: Array.isArray(dataLayer) ? dataLayer.length : 0,
      hasGoogleTagManager: !!global.google_tag_manager,
      googleTagManagerKeys: global.google_tag_manager
        ? Object.keys(global.google_tag_manager).slice(0, 8).join(',')
        : '',
      hasUcUi: !!global.UC_UI,
      hasUsercentrics: !!global.Usercentrics || !!global.UC_UI,
      zowieKeys,
    };
  };
  const rows = [];
  Object.defineProperty(window, '__benchRuntimeErrors', {
    value: rows,
    configurable: true,
  });
  const push = (row) => {
    rows.push({
      at: round(performance.now()),
      ...row,
      state: state(),
    });
    if (rows.length > 100) {
      rows.splice(0, rows.length - 100);
    }
  };
  window.addEventListener('error', (event) => {
    const serialized = serializeValue(event.error || event.message);
    push({
      type: 'error',
      message: serialized.message || event.message || '',
      filename: event.filename || '',
      lineNumber: event.lineno || 0,
      columnNumber: event.colno || 0,
      reasonType: serialized.reasonType || '',
      reason: serialized.reason || '',
      stack: serialized.stack || '',
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const serialized = serializeValue(event.reason);
    push({
      type: 'unhandledrejection',
      message: serialized.message || '',
      reasonType: serialized.reasonType || '',
      reason: serialized.reason || '',
      stack: serialized.stack || '',
    });
  });
})();`,
  });

  page.on('console', (message) => {
    pushLimited(diagnostics.consoleMessages, consoleEntry(message, startedAt), 300);
  });
  page.on('pageerror', (error) => {
    pushLimited(
      diagnostics.pageErrors,
      {
        message: error.message,
        stack: error.stack,
        elapsedMs: elapsedSince(startedAt),
      },
      100,
    );
  });
  page.on('requestfailed', (request) => {
    pushLimited(
      diagnostics.failedRequests,
      {
        ...requestEntry(request),
        errorText: request.failure()?.errorText ?? 'unknown',
        elapsedMs: elapsedSince(startedAt),
      },
      300,
    );
  });
  page.on('response', (response) => {
    const entry = responseEntry(response, startedAt);
    pushLimited(diagnostics.responses, entry, 1_000);
    if (entry.status >= 400) {
      pushLimited(diagnostics.httpErrorResponses, entry, 300);
    }
  });

  return diagnostics;
}

export async function syncBrowserRuntimeErrors(
  page: Page,
  diagnostics: PageDiagnosticsCapture,
): Promise<void> {
  diagnostics.browserRuntimeErrors = await page
    .evaluate(() => {
      return ((window as unknown as {
        __benchRuntimeErrors?: PageDiagnosticsCapture['browserRuntimeErrors'];
      }).__benchRuntimeErrors ?? []);
    })
    .catch(() => diagnostics.browserRuntimeErrors);
}

export function pageDiagnosticsMetrics(
  diagnostics: PageDiagnosticsCapture,
): Record<string, number> {
  return {
    consoleMessages: diagnostics.consoleMessages.length,
    consoleErrors: diagnostics.consoleMessages.filter((row) => row.type === 'error').length,
    consoleWarnings: diagnostics.consoleMessages.filter((row) => row.type === 'warning').length,
    pageErrors: diagnostics.pageErrors.length,
    browserRuntimeErrors: diagnostics.browserRuntimeErrors.length,
    networkFailedRequests: diagnostics.failedRequests.length,
    networkHttpErrorResponses: diagnostics.httpErrorResponses.length,
    networkResponses: diagnostics.responses.length,
  };
}

export function pageDiagnosticsMeta(
  diagnostics: PageDiagnosticsCapture,
): Record<string, string | number | boolean> {
  return {
    consoleMessagesJson: JSON.stringify(diagnostics.consoleMessages),
    pageErrorsJson: JSON.stringify(diagnostics.pageErrors),
    browserRuntimeErrorsJson: JSON.stringify(diagnostics.browserRuntimeErrors),
    networkFailedRequestsJson: JSON.stringify(diagnostics.failedRequests),
    networkHttpErrorResponsesJson: JSON.stringify(diagnostics.httpErrorResponses),
    networkResponsesJson: JSON.stringify(diagnostics.responses),
  };
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

export function writeDebugJson(label: string, data: unknown): string | undefined {
  if (env('BENCH_DEBUG_ARTIFACTS') !== '1') {
    return undefined;
  }

  const dir = debugArtifactsDir();
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${safeArtifactName(label)}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  return outPath;
}

export function writeDebugText(
  label: string,
  data: string,
  extension = 'txt',
): string | undefined {
  if (env('BENCH_DEBUG_ARTIFACTS') !== '1') {
    return undefined;
  }

  const dir = debugArtifactsDir();
  fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${safeArtifactName(label)}.${safeArtifactName(extension)}`);
  fs.writeFileSync(outPath, data, 'utf8');
  return outPath;
}

export async function startChromeTrace(
  page: Page,
  label: string,
): Promise<{ stop: () => Promise<string | undefined> }> {
  if (env('BENCH_CHROME_TRACE') !== '1') {
    return { stop: async () => undefined };
  }

  const session = await page.context().newCDPSession(page);
  const traceEvents: unknown[] = [];
  session.on('Tracing.dataCollected', (event: { value?: unknown[] }) => {
    traceEvents.push(...(event.value ?? []));
  });

  await session.send('Tracing.start', {
    categories: [
      'benchmark',
      'blink.user_timing',
      'cc',
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-latencyInfo',
      'latencyInfo',
      'loading',
      'toplevel',
      'v8',
    ].join(','),
    transferMode: 'ReportEvents',
  });

  return {
    stop: async () => {
      const complete = new Promise<void>((resolve) => {
        session.once('Tracing.tracingComplete', () => resolve());
      });
      await session.send('Tracing.end');
      await complete;
      await session.detach().catch(() => {});
      return writeDebugJson(label, { traceEvents });
    },
  };
}

export async function startCpuProfile(
  page: Page,
  label: string,
): Promise<{ stop: () => Promise<string | undefined> }> {
  if (env('BENCH_CPU_PROFILE') !== '1') {
    return { stop: async () => undefined };
  }

  const session = await page.context().newCDPSession(page);
  await session.send('Profiler.enable');
  await session.send('Profiler.setSamplingInterval', { interval: 100 });
  await session.send('Profiler.start');

  return {
    stop: async () => {
      try {
        const profile = await session.send('Profiler.stop');
        return writeDebugJson(label, profile);
      } finally {
        await session.send('Profiler.disable').catch(() => {});
        await session.detach().catch(() => {});
      }
    },
  };
}

function percentile(values: number[], p: number): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return roundMetric(sorted[index]);
}

export async function captureBrowserSystemInfo(
  page: Page,
  label: string,
): Promise<string | undefined> {
  if (env('BENCH_CAPTURE_BROWSER_SYSTEM') !== '1') {
    return undefined;
  }

  const browser = page.context().browser();
  const pageGraphics = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const gl = (
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    ) as WebGLRenderingContext | null;
    const debugRendererInfo = gl?.getExtension('WEBGL_debug_renderer_info');

    return {
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
      hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      webglVendor:
        gl && debugRendererInfo
          ? String(gl.getParameter(debugRendererInfo.UNMASKED_VENDOR_WEBGL))
          : '',
      webglRenderer:
        gl && debugRendererInfo
          ? String(gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL))
          : '',
    };
  });

  if (!browser) {
    return writeDebugJson(label, {
      pageGraphics,
      systemInfoError: 'browser is not attached to this page context',
    });
  }

  const session = await browser.newBrowserCDPSession();
  try {
    const systemInfo = await session.send('SystemInfo.getInfo').catch((err) => ({
      error: err instanceof Error ? err.message : String(err),
    }));
    return writeDebugJson(label, { pageGraphics, systemInfo });
  } finally {
    await session.detach().catch(() => {});
  }
}

export async function captureRafCadence(
  page: Page,
  label: string,
): Promise<string | undefined> {
  if (env('BENCH_RAF_CADENCE') !== '1') {
    return undefined;
  }

  const frameCount = Math.max(10, Math.floor(Number(env('BENCH_RAF_CADENCE_FRAMES', '120'))));
  const cadence = await page.evaluate((count) => {
    return new Promise<{
      frameCount: number;
      deltas: number[];
      min: number;
      max: number;
      mean: number;
      p50: number;
      p95: number;
      over20ms: number;
      over30ms: number;
    }>((resolve) => {
      const timestamps: number[] = [];

      const finish = () => {
        const deltas = timestamps
          .slice(1)
          .map((timestamp, index) => Math.round((timestamp - timestamps[index]) * 100) / 100);
        const sorted = [...deltas].sort((a, b) => a - b);
        const sum = deltas.reduce((total, value) => total + value, 0);
        const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] ?? 0;

        resolve({
          frameCount: timestamps.length,
          deltas,
          min: sorted[0] ?? 0,
          max: sorted[sorted.length - 1] ?? 0,
          mean: deltas.length ? Math.round((sum / deltas.length) * 100) / 100 : 0,
          p50: at(0.5),
          p95: at(0.95),
          over20ms: deltas.filter((value) => value > 20).length,
          over30ms: deltas.filter((value) => value > 30).length,
        });
      };

      const tick = (timestamp: number) => {
        timestamps.push(timestamp);
        if (timestamps.length >= count) {
          finish();
          return;
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }, frameCount);

  return writeDebugJson(label, {
    ...cadence,
    min: roundMetric(cadence.min),
    max: roundMetric(cadence.max),
    mean: roundMetric(cadence.mean),
    p50: percentile(cadence.deltas, 0.5),
    p95: percentile(cadence.deltas, 0.95),
  });
}

function scriptBodyPatterns(): string[] {
  const raw = env('BENCH_CAPTURE_SCRIPT_BODY_PATTERNS', '').trim();
  if (!raw) {
    return ['chunk-X3VYBJZ7.js'];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((value) => typeof value === 'string')) {
      return parsed;
    }
  } catch {
    // Fall back to comma-separated values below.
  }

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function captureScriptBodies(
  page: Page,
  label: string,
): Promise<string | undefined> {
  if (env('BENCH_CAPTURE_SCRIPT_BODIES') !== '1') {
    return undefined;
  }

  const patterns = scriptBodyPatterns();
  const results = await page.evaluate(async (inputs) => {
    const resources = performance
      .getEntriesByType('resource')
      .filter((entry): entry is PerformanceResourceTiming => entry instanceof PerformanceResourceTiming)
      .filter((entry) => entry.initiatorType === 'script')
      .map((entry) => entry.name)
      .filter((url, index, rows) => rows.indexOf(url) === index)
      .filter((url) => inputs.some((pattern) => url.includes(pattern)));

    return Promise.all(
      resources.map(async (url) => {
        try {
          const response = await fetch(url, {
            cache: 'force-cache',
            credentials: 'include',
            mode: 'cors',
          });
          const body = await response.text();
          return {
            url,
            ok: response.ok,
            status: response.status,
            contentType: response.headers.get('content-type') || '',
            body,
          };
        } catch (err) {
          return {
            url,
            ok: false,
            status: 0,
            contentType: '',
            error: err instanceof Error ? err.message : String(err),
            body: '',
          };
        }
      }),
    );
  }, patterns);

  const manifest = results.map((result, index) => ({
    url: result.url,
    ok: result.ok,
    status: result.status,
    contentType: result.contentType,
    bytes: result.body.length,
    error: 'error' in result ? result.error : '',
    path: result.body
      ? writeDebugText(`${label}-${index}-${path.basename(new URL(result.url).pathname)}`, result.body, 'js')
      : '',
  }));

  return writeDebugJson(label, { patterns, scripts: manifest });
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

async function applyBrowserCpuThrottle(
  context: BrowserContext,
  page: Page,
): Promise<() => Promise<void>> {
  const rate = Number(env('BENCH_BROWSER_CPU_THROTTLE_RATE', '0'));
  if (!Number.isFinite(rate) || rate <= 1) {
    return async () => {};
  }

  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });

  return async () => {
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    await session.detach().catch(() => {});
  };
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
    const cleanupThrottle = await applyBrowserCpuThrottle(page.context(), page);
    return {
      browser,
      page,
      cleanup: async () => {
        await cleanupThrottle();
        await browser.close();
      },
    };
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
        const cleanupThrottle = await applyBrowserCpuThrottle(context, page);
        return {
          browser,
          page,
          cleanup: async () => {
            await cleanupThrottle();
          },
        };
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
    const resources = performance
      .getEntriesByType('resource')
      .map((entry) => {
        const resource = entry as PerformanceResourceTiming & {
          responseStatus?: number;
          renderBlockingStatus?: string;
        };
        let host = '';
        let pathname = '';
        try {
          const url = new URL(resource.name);
          host = url.host;
          pathname = url.pathname;
        } catch {
          pathname = resource.name;
        }
        return {
          name: resource.name,
          host,
          pathname,
          initiatorType: resource.initiatorType || '',
          startTime: round(resource.startTime),
          responseEnd: round(resource.responseEnd),
          duration: round(resource.duration),
          transferSize: Math.round(resource.transferSize || 0),
          encodedBodySize: Math.round(resource.encodedBodySize || 0),
          decodedBodySize: Math.round(resource.decodedBodySize || 0),
          responseStatus: Number(resource.responseStatus || 0),
          renderBlockingStatus: resource.renderBlockingStatus || '',
        };
      });
    const summaryByKey = new Map<
      string,
      {
        host: string;
        initiatorType: string;
        count: number;
        transferSize: number;
        encodedBodySize: number;
        decodedBodySize: number;
        duration: number;
        httpErrors: number;
      }
    >();
    for (const resource of resources) {
      const key = `${resource.host}\t${resource.initiatorType}`;
      const existing =
        summaryByKey.get(key) ??
        {
          host: resource.host,
          initiatorType: resource.initiatorType,
          count: 0,
          transferSize: 0,
          encodedBodySize: 0,
          decodedBodySize: 0,
          duration: 0,
          httpErrors: 0,
        };
      existing.count += 1;
      existing.transferSize += resource.transferSize;
      existing.encodedBodySize += resource.encodedBodySize;
      existing.decodedBodySize += resource.decodedBodySize;
      existing.duration += resource.duration;
      existing.httpErrors += resource.responseStatus >= 400 ? 1 : 0;
      summaryByKey.set(key, existing);
    }
    const resourceTimingSummary = Array.from(summaryByKey.values())
      .map((row) => ({
        ...row,
        duration: round(row.duration),
      }))
      .sort((a, b) => b.count - a.count || b.transferSize - a.transferSize);

    return {
      vitals: state?.latest ?? {},
      history: state?.history ?? [],
      eventTimingMaxMs: state?.eventTimingMaxMs ?? 0,
      eventTimingCount: state?.eventTimingCount ?? 0,
      eventTimingEntries: state?.eventTimingEntries ?? [],
      resourceTimingEntries: resources.slice(0, 500),
      resourceTimingSummary,
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

export async function flushWebVitalsInp(page: Page): Promise<void> {
  const timeoutMs = webVitalsInpFlushTimeoutMs();
  if (timeoutMs <= 0) {
    return;
  }

  await page
    .waitForFunction(
      () => {
        const state = (window as unknown as {
          __benchWebVitals?: {
            latest?: Record<string, VitalMetric>;
            eventTimingMaxMs?: number;
          };
        }).__benchWebVitals;
        return (
          typeof state?.latest?.['INP']?.value === 'number' ||
          (state?.eventTimingMaxMs ?? 0) > 0
        );
      },
      undefined,
      { timeout: timeoutMs },
    )
    .catch(() => {});

  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const hasInp = await page
      .evaluate(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        const state = (window as unknown as {
          __benchWebVitals?: { latest?: Record<string, VitalMetric> };
        }).__benchWebVitals;
        return typeof state?.latest?.['INP']?.value === 'number';
      })
      .catch(() => false);

    if (hasInp) {
      return;
    }

    await page.waitForTimeout(100);
  }
}

export function toBenchMetrics(
  snapshot: BrowserMetricSnapshot,
  timing: ScenarioTiming,
  warmup?: WarmupResult,
): {
  metrics: Record<string, number>;
  inpSource: string;
} {
  const cpuThrottlingRate = Number(env('BENCH_BROWSER_CPU_THROTTLE_RATE', '0'));
  const metrics: Record<string, number> = {
    scenarioDurationMs: roundMetric(timing.scenarioDurationMs),
    interactionWallMs: roundMetric(timing.interactionWallMs),
    eventTimingMaxMs: roundMetric(snapshot.eventTimingMaxMs),
    eventTimingCount: snapshot.eventTimingCount,
    browserCpuThrottleRate:
      Number.isFinite(cpuThrottlingRate) && cpuThrottlingRate > 1
        ? roundMetric(cpuThrottlingRate)
        : 0,
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
