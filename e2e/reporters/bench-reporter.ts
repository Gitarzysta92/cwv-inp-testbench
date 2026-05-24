import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

type ScenarioRow = {
  title: string;
  file: string;
  line: number;
  status: TestResult['status'];
  durationMs: number;
  metrics?: unknown;
};

/**
 * Writes one JSON file per Playwright invocation (config × run index), for downstream aggregation.
 */
export default class BenchReporter implements Reporter {
  private scenarios: ScenarioRow[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const att = result.attachments.find((a) => a.name === 'bench-metrics.json');
    let metrics: unknown;
    if (att?.body) {
      try {
        metrics = JSON.parse(att.body.toString('utf8'));
      } catch {
        metrics = { parseError: true };
      }
    }
    this.scenarios.push({
      title: test.title,
      file: test.location.file,
      line: test.location.line,
      status: result.status,
      durationMs: result.duration,
      metrics,
    });
  }

  onEnd(): void {
    const outDir = process.env.BENCH_RESULTS_DIR ?? path.join('bench-results', 'raw');
    fs.mkdirSync(outDir, { recursive: true });
    const configId = process.env.BENCH_CONFIG_ID ?? 'default';
    const runIndex = Number(process.env.BENCH_RUN_INDEX ?? '0');
    const invocationId = process.env.BENCH_INVOCATION_ID ?? `${Date.now()}`;
    const payload = {
      schema: 'cwv-bench-invocation/1',
      configId,
      configLabel: process.env.BENCH_CONFIG_LABEL ?? '',
      runIndex,
      invocationId,
      timestamp: new Date().toISOString(),
      scenarios: this.scenarios,
    };
    const file = path.join(outDir, `${configId}-run${runIndex}-${invocationId}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  }
}
