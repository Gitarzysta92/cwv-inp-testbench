import { onINP, type INPMetric } from 'web-vitals';

/**
 * Latest web-vitals INP snapshot for lab tests (Playwright reads via page.evaluate).
 * Not secret — exposed intentionally for deterministic bench automation.
 */
export type CwvBenchInpSnapshot = {
  value: number;
  delta: number;
  id: string;
  rating: string;
  navigationType: string;
  entryCount: number;
  reportedAt: number;
};

declare global {
  interface Window {
    __CWV_BENCH_VITALS__?: {
      inp?: CwvBenchInpSnapshot;
    };
  }
}

function pushInp(metric: INPMetric): void {
  window.__CWV_BENCH_VITALS__ = {
    inp: {
      value: metric.value,
      delta: metric.delta,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType,
      entryCount: metric.entries.length,
      reportedAt: Date.now(),
    },
  };
}

onINP(pushInp, {
  reportAllChanges: true,
  durationThreshold: 0,
});
