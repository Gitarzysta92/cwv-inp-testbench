#!/usr/bin/env node
/**
 * Snapshot Lighthouse lab scores for a URL (pair with a running dev/static server).
 * Interaction INP remains owned by Playwright scenarios + bench-metrics.
 *
 * Usage:
 *   LH_URL=http://127.0.0.1:4200/scenario/a node scripts/lighthouse-run.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const url =
  process.env.LH_URL ?? 'http://127.0.0.1:4200/scenario/a';
const outDir = join(root, process.env.LH_OUTPUT_DIR ?? 'bench-results');

async function main() {
  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
  });
  try {
    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
    });
    const report = runnerResult?.report;
    if (!report || typeof report !== 'string') {
      console.error('Lighthouse returned no JSON report');
      process.exit(1);
    }
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'lighthouse.json');
    writeFileSync(outPath, report, 'utf8');
    console.error(`Wrote ${outPath}`);
  } finally {
    await chrome.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
