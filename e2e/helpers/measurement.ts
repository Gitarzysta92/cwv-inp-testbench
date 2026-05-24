import type { Page } from '@playwright/test';

export type EventTimingSample = {
  name: string;
  duration: number;
  interactionId?: number;
  processingStart?: number;
  processingEnd?: number;
};

/** Mirrors `CwvBenchInpSnapshot` from src/web-vitals-bench.ts */
export type WebVitalsInpSnapshot = {
  value: number;
  delta: number;
  id: string;
  rating: string;
  navigationType: string;
  entryCount: number;
  reportedAt: number;
};

/**
 * Reads PerformanceEventTiming entries after an interaction (Chromium-oriented lab helper).
 * Supplementary to web-vitals INP — useful when Event Timing is exposed but INP is delayed.
 */
export async function readRecentEventTiming(page: Page): Promise<EventTimingSample[]> {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType('event') as PerformanceEventTiming[];
    return entries.slice(-20).map((e) => ({
      name: e.name,
      duration: e.duration,
      interactionId: e.interactionId,
      processingStart: e.processingStart,
      processingEnd: e.processingEnd,
    }));
  });
}

export async function readWebVitalsInp(page: Page): Promise<WebVitalsInpSnapshot | null> {
  return page.evaluate(() => {
    const snap = window.__CWV_BENCH_VITALS__?.inp;
    return snap ?? null;
  });
}

/**
 * Lets web-vitals flush INP after the last interaction (next frames + rAF).
 */
export async function settleWebVitalsInp(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 120);
        });
      });
    });
  });
}

/** Event-timing max + web-vitals INP (`inpMs`) after settle — primary lab INP signal is `inpMs`. */
export async function collectLabMetrics(page: Page): Promise<{
  eventTimingMaxMs: number;
  inpMs?: number;
}> {
  await settleWebVitalsInp(page);
  const ev = await readRecentEventTiming(page);
  const eventTimingMaxMs = ev.length ? Math.max(...ev.map((e) => e.duration)) : 0;
  const inp = await readWebVitalsInp(page);
  if (inp != null && Number.isFinite(inp.value)) {
    return { eventTimingMaxMs, inpMs: inp.value };
  }
  return { eventTimingMaxMs };
}
