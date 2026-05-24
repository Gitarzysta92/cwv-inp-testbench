import type { TestInfo } from '@playwright/test';

export type BenchMetricsPayload = {
  scenarioId: string;
  metrics: Record<string, number>;
  meta?: Record<string, string | number | boolean>;
};

/**
 * Persists one scenario sample per test invocation; the bench reporter packs files per Playwright run.
 */
export async function attachBenchMetrics(
  testInfo: TestInfo,
  payload: BenchMetricsPayload,
): Promise<void> {
  await testInfo.attach('bench-metrics.json', {
    body: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
    contentType: 'application/json',
  });
}
