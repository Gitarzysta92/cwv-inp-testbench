#!/usr/bin/env node
/**
 * Euro.com.pl menu-open experiment using the playwright-web-vitals client.
 *
 *   npx tsx src/experiments/euro-menu-playwright-web-vitals-experiment.ts --local
 *   npx tsx src/experiments/euro-menu-playwright-web-vitals-experiment.ts --docker
 *
 * Runtime owns the warm_assets pass and exports BENCH_WARMUP_RESULT_JSON.
 * The scenario refuses to measure if runtime did not verify cache hits during warmup.
 */
import * as path from 'path';
import type { LabDefinition, Observation } from '../lab/types';
import { runLabSession } from '../orchestrator/run-lab-session';
import { upDockerStack, upLocalStack } from '../runtime/tests/stack';
import { EURO_APP_URL, euroLiveProfile } from './euro-offline-replay-fixtures';

const SCENARIO_ID = 'scenario-euro-open-menu';
const PROFILE_ID = 'live-euro-menu-web-vitals';
const SPEC_PATH = 'src/scenarios/playwright-web-vitals/euro-open-menu.spec.ts';

function readReplicates(): number {
  const raw = Number(process.env['BENCH_REPLICATES'] ?? 1);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

function experimentDefinition(): LabDefinition {
  return {
    lab: {
      cohort: {
        hostClass: process.env['BENCH_HOST_CLASS'] ?? 'runtime-docker',
        appVersion: process.env['GIT_SHA'] ?? 'dev',
      },
      methodology: {
        replicates: readReplicates(),
        schedule: 'sequential',
        metric: 'inpMs',
        percentiles: [50, 75, 95],
        trimExtremesPercent: 0,
        gate: {
          baselineProfileId: PROFILE_ID,
          acceptableDeltaMs: 40,
        },
      },
      client: 'playwright-web-vitals',
    },
    profiles: [
      euroLiveProfile({
        id: PROFILE_ID,
        label: 'Live Euro menu with warmed browser cache',
        warmup: 'warm_assets',
      }),
    ],
    scenarios: [
      {
        id: SCENARIO_ID,
        label: 'Euro open main menu',
        description: [
          'Runtime warms Euro homepage assets',
          'Verify warmed browser cache before measurement',
          'Open the main menu',
          'Measure INP through web-vitals/onINP',
        ],
      },
    ],
  };
}

function describeObservation(observation: Observation): string {
  const metrics = Object.entries(observation.metrics)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return `${observation.meta.status}: ${observation.profileId}/${observation.scenarioId} ${metrics}`;
}

async function main(): Promise<void> {
  const useDocker = process.argv.includes('--docker');
  const useLocal = process.argv.includes('--local');
  const repoRoot = path.resolve(process.cwd());
  const definition = experimentDefinition();

  console.error('\nEuro menu playwright-web-vitals experiment');
  console.error(`  app:        ${EURO_APP_URL}`);
  console.error(`  client:     ${definition.lab.client}`);
  console.error(`  scenario:   ${SCENARIO_ID}`);
  console.error(`  spec:       ${SPEC_PATH}`);
  console.error(`  warmup:     warm_assets`);
  console.error(`  replicates: ${definition.lab.methodology.replicates}\n`);

  let stack: Awaited<ReturnType<typeof upDockerStack>> | undefined;

  if (useDocker) {
    console.error('Starting Docker runtime stack...\n');
    stack = await upDockerStack();
  } else if (useLocal) {
    console.error('Starting local runtime stack...\n');
    stack = await upLocalStack({ appUrl: EURO_APP_URL });
  } else {
    throw new Error('Pass --docker or --local so the experiment can prepare a runtime browser.');
  }

  try {
    process.env['BENCH_PLAYWRIGHT_SPEC'] = SPEC_PATH;
    const result = await runLabSession({
      definition,
      repoRoot,
      runtimeApiUrl: stack.apiUrl,
    });

    for (const observation of result.observations) {
      console.error(`  observation: ${describeObservation(observation)}`);
    }

    if (result.failures > 0) {
      throw new Error(`${result.failures} Euro menu observation(s) failed`);
    }
  } finally {
    console.error('\nStopping stack...');
    await stack.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
