#!/usr/bin/env node
/**
 * Reads bench-results/raw/*.json and writes summary JSON + human-readable table.
 * Trim policy: sort samples, drop floor(n * p/100) from each end when trimExtremesPercent > 0.
 * Includes worst (max) per series and optional acceptableDeltaMs for regression gating.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function percentileLinear(sorted, p) {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function trimSamples(sorted, trimPercent) {
  if (!trimPercent || trimPercent <= 0) return sorted;
  const n = sorted.length;
  const k = Math.floor((n * trimPercent) / 100);
  if (k <= 0 || n - 2 * k < 1) return sorted;
  return sorted.slice(k, n - k);
}

function parseArgs(argv) {
  let configPath = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) configPath = argv[++i];
  }
  return { configPath };
}

function loadMatrixConfig(root, explicitPath) {
  const cfgPath = explicitPath
    ? path.resolve(explicitPath)
    : process.env.BENCH_MATRIX_CONFIG
      ? path.resolve(process.env.BENCH_MATRIX_CONFIG)
      : path.join(root, 'bench-matrix.config.json');
  if (!fs.existsSync(cfgPath)) return { aggregate: {} };
  return JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
}

function main() {
  const root = path.join(__dirname, '..');
  const args = parseArgs(process.argv);
  const matrix = loadMatrixConfig(root, args.configPath);
  const rawDir = path.join(root, matrix.outputDir ?? 'bench-results', 'raw');
  const outDir = path.join(root, matrix.outputDir ?? 'bench-results');
  const aggCfg = matrix.aggregate ?? {};
  const metricKeys = aggCfg.metrics ?? ['eventTimingMaxMs'];
  const percentiles = aggCfg.percentiles ?? [50, 75, 95];
  const trimExtremesPercent = aggCfg.trimExtremesPercent ?? 0;
  const acceptableDeltaMs = aggCfg.acceptableDeltaMs ?? null;

  if (!fs.existsSync(rawDir)) {
    console.error(`No raw results directory: ${rawDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(rawDir).filter((f) => f.endsWith('.json'));
  /** @type {Map<string, { configId: string, scenarioId: string, metric: string, values: number[] }>} */
  const groups = new Map();

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(rawDir, file), 'utf8'));
    const configId = data.configId ?? 'unknown';
    for (const row of data.scenarios ?? []) {
      const payload = row.metrics;
      if (!payload || typeof payload !== 'object') continue;
      const scenarioId = payload.scenarioId ?? row.title;
      const metrics = payload.metrics;
      if (!metrics || typeof metrics !== 'object') continue;
      for (const mk of metricKeys) {
        const v = metrics[mk];
        if (typeof v !== 'number' || Number.isNaN(v)) continue;
        const key = `${configId}::${scenarioId}::${mk}`;
        if (!groups.has(key)) {
          groups.set(key, { configId, scenarioId, metric: mk, values: [] });
        }
        groups.get(key).values.push(v);
      }
    }
  }

  const summary = {
    schema: 'cwv-bench-summary/2',
    generatedAt: new Date().toISOString(),
    rawFiles: files.length,
    trimExtremesPercent,
    acceptableDeltaMs,
    percentiles,
    metrics: metricKeys,
    rows: [],
  };

  const tableLines = [];
  tableLines.push(
    [
      'configId',
      'scenarioId',
      'metric',
      'n',
      ...percentiles.map((p) => `p${p}`),
      'worst',
    ].join('\t'),
  );

  for (const g of groups.values()) {
    const sorted = [...g.values].sort((a, b) => a - b);
    const trimmed = trimSamples(sorted, trimExtremesPercent);
    const worst = sorted.length ? sorted[sorted.length - 1] : NaN;
    const row = {
      configId: g.configId,
      scenarioId: g.scenarioId,
      metric: g.metric,
      count: sorted.length,
      countUsed: trimmed.length,
      stats: {},
      worst: Number.isFinite(worst) ? Number(worst.toFixed(4)) : null,
    };
    for (const p of percentiles) {
      const label = `p${p}`;
      row.stats[label] = Number(percentileLinear(trimmed, p).toFixed(4));
    }
    summary.rows.push(row);
    tableLines.push(
      [
        g.configId,
        g.scenarioId,
        g.metric,
        trimmed.length,
        ...percentiles.map((p) => row.stats[`p${p}`]),
        row.worst ?? '',
      ].join('\t'),
    );
  }

  summary.rows.sort((a, b) =>
    `${a.configId}${a.scenarioId}${a.metric}`.localeCompare(`${b.configId}${b.scenarioId}${b.metric}`),
  );

  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  const tablePath = path.join(outDir, 'summary.tsv');
  fs.writeFileSync(tablePath, tableLines.join('\n') + '\n', 'utf8');

  console.log(`Wrote ${summaryPath}`);
  console.log(`Wrote ${tablePath}`);
  console.log('\n' + tableLines.join('\n'));
  if (acceptableDeltaMs != null) {
    console.log(
      `\nacceptableDeltaMs=${acceptableDeltaMs} (use for regression gates vs baseline; not auto-applied here).`,
    );
  }
}

main();
