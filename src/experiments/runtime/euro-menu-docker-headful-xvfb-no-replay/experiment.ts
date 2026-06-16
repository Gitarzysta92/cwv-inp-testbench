#!/usr/bin/env node
/**
 * Euro hamburger menu lab on headful Chromium inside Docker/Xvfb, without runtime replay cache.
 *
 *   npm run bench:runtime:euro:menu:docker-headful-xvfb:no-replay
 *   BENCH_REPLICATES=1 npm run bench:runtime:euro:menu:docker-headful-xvfb:no-replay
 */
import { dockerHeadfulXvfbNoReplayRuntime } from '../../../runtime';
import { runEuroMenuRuntimeExperiment } from '../euro-menu-runtime/run';

export function runEuroMenuDockerHeadfulXvfbNoReplayExperiment() {
  return runEuroMenuRuntimeExperiment(dockerHeadfulXvfbNoReplayRuntime);
}

if (require.main === module) {
  runEuroMenuDockerHeadfulXvfbNoReplayExperiment().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
