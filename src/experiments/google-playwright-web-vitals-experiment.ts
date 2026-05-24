#!/usr/bin/env node
/**
 * Google runtime experiment using the playwright-web-vitals client.
 *
 *   npx tsx src/experiments/google-playwright-web-vitals-experiment.ts --local
 *   npx tsx src/experiments/google-playwright-web-vitals-experiment.ts --docker
 *
 * Flow:
 * 1. Start a runtime browser stack.
 * 2. Let the orchestrator prepare one live Google step through the runtime API.
 * 3. Run the playwright-web-vitals client against the prepared CDP target.
 * 4. Print the normalized observation and report paths.
 */
import * as path from 'path';
import type { LabDefinition, Observation } from '../lab/types';
import { runLabSession } from '../orchestrator/run-lab-session';
import { upDockerStack, upLocalStack } from '../runtime/tests/stack';
import { GOOGLE_APP_URL, googleLiveProfile } from './google-offline-replay-fixtures';

const SCENARIO_ID = 'scenario-google-web-vitals-probe';
const PROFILE_ID = 'live-google-web-vitals';

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
      googleLiveProfile({
        id: PROFILE_ID,
        label: 'Live Google with playwright-web-vitals',
      }),
    ],
    scenarios: [
      {
        id: SCENARIO_ID,
        label: 'Google web-vitals probe interaction',
        description: [
          'Open Google homepage',
          'Inject and click a deterministic INP probe',
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

  console.error('\nGoogle playwright-web-vitals experiment');
  console.error(`  app:        ${GOOGLE_APP_URL}`);
  console.error(`  client:     ${definition.lab.client}`);
  console.error(`  scenario:   ${SCENARIO_ID}`);
  console.error(`  replicates: ${definition.lab.methodology.replicates}\n`);

  let stack: Awaited<ReturnType<typeof upDockerStack>> | undefined;

  if (useDocker) {
    console.error('Starting Docker runtime stack...\n');
    stack = await upDockerStack();
  } else if (useLocal) {
    console.error('Starting local runtime stack...\n');
    stack = await upLocalStack({ appUrl: GOOGLE_APP_URL });
  } else {
    throw new Error('Pass --docker or --local so the experiment can prepare a runtime browser.');
  }

  try {
    const result = await runLabSession({
      definition,
      repoRoot,
      runtimeApiUrl: stack.apiUrl,
    });

    for (const observation of result.observations) {
      console.error(`  observation: ${describeObservation(observation)}`);
    }

    if (result.failures > 0) {
      throw new Error(`${result.failures} playwright-web-vitals observation(s) failed`);
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
