#!/usr/bin/env node
/**
 * Euro hamburger menu lab on headful Chromium inside Docker/Xvfb.
 *
 *   npm run bench:runtime:euro:menu:docker-headful-xvfb
 *   BENCH_REPLICATES=1 npm run bench:runtime:euro:menu:docker-headful-xvfb
 */
import { dockerHeadfulXvfbRuntime } from '../../../runtime';
import { runEuroMenuRuntimeExperiment } from '../euro-menu-runtime/run';

export function runEuroMenuDockerHeadfulXvfbExperiment() {
  return runEuroMenuRuntimeExperiment(dockerHeadfulXvfbRuntime);
}

if (require.main === module) {
  runEuroMenuDockerHeadfulXvfbExperiment().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
