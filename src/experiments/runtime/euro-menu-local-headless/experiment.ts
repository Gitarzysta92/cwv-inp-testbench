#!/usr/bin/env node
/**
 * Euro hamburger menu lab on local headless Chromium outside Docker.
 *
 *   npm run bench:runtime:euro:menu:local-headless
 *   BENCH_REPLICATES=1 npm run bench:runtime:euro:menu:local-headless
 *   BENCH_HEADLESS_CPU_THROTTLE_RATE=8 BENCH_REPLICATES=1 npm run bench:runtime:euro:menu:local-headless
 */
import { localHeadlessRuntime } from '../../../runtime/local-headless';
import { runEuroMenuRuntimeExperiment } from '../euro-menu-runtime/run';

export function runEuroMenuLocalHeadlessExperiment() {
  return runEuroMenuRuntimeExperiment(localHeadlessRuntime);
}

if (require.main === module) {
  runEuroMenuLocalHeadlessExperiment().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
