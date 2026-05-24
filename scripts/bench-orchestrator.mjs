#!/usr/bin/env node
/**
 * Bench orchestrator: runs Playwright per matrix configuration × runs, then aggregates.
 *
 * Usage:
 *   node scripts/bench-orchestrator.mjs
 *   node scripts/bench-orchestrator.mjs --config ./bench-matrix.config.json
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = { config: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) {
      out.config = argv[++i];
    }
  }
  return out;
}

function loadConfig(root, configPath) {
  const p = configPath
    ? path.resolve(configPath)
    : path.join(root, 'bench-matrix.config.json');
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function main() {
  const root = path.join(__dirname, '..');
  const args = parseArgs(process.argv);
  const matrix = loadConfig(root, args.config);

  const outputDir = path.join(root, matrix.outputDir ?? 'bench-results');
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const runs = Number(matrix.runs ?? 1);
  const configurations = matrix.configurations ?? [{ id: 'default', label: 'default', env: {} }];
  const playwrightArgs = matrix.playwrightArgs ?? [];

  let failures = 0;

  for (const cfg of configurations) {
    const configId = cfg.id ?? 'default';
    const label = cfg.label ?? configId;
    const envBase = { ...(cfg.env ?? {}) };

    for (let runIndex = 0; runIndex < runs; runIndex++) {
      const invocationId = randomUUID();
      const env = {
        ...process.env,
        ...envBase,
        BENCH_ORCHESTRATED: '1',
        BENCH_RESULTS_DIR: rawDir,
        BENCH_CONFIG_ID: configId,
        BENCH_CONFIG_LABEL: label,
        BENCH_RUN_INDEX: String(runIndex),
        BENCH_INVOCATION_ID: invocationId,
      };

      console.error(
        `\n━━━ Bench: config=${configId} run=${runIndex + 1}/${runs} invocation=${invocationId} ━━━\n`,
      );

      const r = spawnSync(
        'npx',
        ['playwright', 'test', ...playwrightArgs],
        {
          cwd: root,
          env,
          stdio: 'inherit',
          shell: false,
        },
      );

      if (r.status !== 0) {
        failures += 1;
        console.error(`Playwright exited with status ${r.status}`);
      }
    }
  }

  console.error('\n━━━ Aggregating ━━━\n');
  const configAbs = args.config
    ? path.resolve(args.config)
    : path.join(root, 'bench-matrix.config.json');
  const agg = spawnSync(
    'node',
    [path.join(__dirname, 'bench-aggregate.mjs'), '--config', configAbs],
    {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    },
  );
  if (agg.status !== 0) {
    process.exit(agg.status ?? 1);
  }

  if (failures > 0) {
    console.error(`\nCompleted with ${failures} failed Playwright invocation(s).`);
    process.exit(1);
  }
}

main();
