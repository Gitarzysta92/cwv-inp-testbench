import { expect, test } from '@playwright/test';
import type { Page } from 'playwright';
import {
  connectPreparedPage,
  env,
  inpProbeDelayMs,
  installWebVitals,
  readBrowserMetrics,
  toBenchMetrics,
  writeInvocation,
  type ScenarioTiming,
  type VitalMetric,
} from './shared';

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
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: 'google-inp-probe',
  };
}

test('google web-vitals probe', async () => {
  const scenarioId = env('BENCH_SCENARIO_ID', 'scenario-google-web-vitals-probe');
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
        interactionLabel: timing.interactionLabel ?? scenarioId,
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
