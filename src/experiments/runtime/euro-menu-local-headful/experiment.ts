#!/usr/bin/env node
/**
 * Euro hamburger menu lab on local headful Chromium outside Docker.
 *
 *   npm run bench:runtime:euro:menu:local-headful
 *   BENCH_REPLICATES=1 npm run bench:runtime:euro:menu:local-headful
 */
import { localHeadfulRuntime } from '../../../runtime';
import { runEuroMenuRuntimeExperiment } from '../euro-menu-runtime/run';

export function runEuroMenuLocalHeadfulExperiment() {
  return runEuroMenuRuntimeExperiment(localHeadfulRuntime);
}

if (require.main === module) {
  runEuroMenuLocalHeadfulExperiment().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
