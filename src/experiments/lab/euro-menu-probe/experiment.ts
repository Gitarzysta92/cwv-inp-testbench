#!/usr/bin/env node
/**
 * Euro hamburger menu — single-scenario web-vitals probe.
 *
 *   npx tsx src/experiments/lab/euro-menu-probe/experiment.ts --docker
 *   npx tsx src/experiments/lab/euro-menu-probe/experiment.ts --local
 */
import * as path from 'path';
import type { LabDefinition } from '../../../lab/types';
import { runLabSession, type RunLabSessionResult } from '../../../orchestrator/run-lab-session';
import { upDockerStack, upLocalStack } from '../../../runtime/tests/stack';
import { EURO_APP_URL, euroLiveProfile } from '../euro-cwv-lab/profiles';
import { EURO_MENU_SCENARIO_ID, EURO_MENU_SPEC_PATH } from '../euro-cwv-lab/definition';

export type StackMode = 'docker' | 'local';

function readReplicates(): number {
  const raw = Number(process.env['BENCH_REPLICATES'] ?? 1);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

export async function runEuroMenuProbe(stackMode: StackMode): Promise<RunLabSessionResult> {
  const repoRoot = path.resolve(process.cwd());
  const profileId = 'live-euro-menu-web-vitals';
  const definition: LabDefinition = {
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
        metricBoundaries: {
          inpMs: { min: 10, max: 300 },
          eventTimingMaxMs: { min: 10, max: 300 },
        },
        gate: {
          baselineProfileId: profileId,
          acceptableDeltaMs: 40,
        },
      },
      client: 'playwright-web-vitals',
    },
    profiles: [
      euroLiveProfile({
        id: profileId,
        label: 'Live Euro menu with warmed browser cache',
        warmup: 'warm_assets',
      }),
    ],
    scenarios: [
      {
        id: EURO_MENU_SCENARIO_ID,
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

  console.error('\nEuro menu probe');
  console.error(`  app:        ${EURO_APP_URL}`);
  console.error(`  scenario:   ${EURO_MENU_SCENARIO_ID}`);
  console.error(`  spec:       ${EURO_MENU_SPEC_PATH}`);
  console.error(`  replicates: ${definition.lab.methodology.replicates}\n`);

  const stack =
    stackMode === 'docker'
      ? await upDockerStack()
      : await upLocalStack({ appUrl: EURO_APP_URL });

  try {
    process.env['BENCH_PLAYWRIGHT_SPEC'] = EURO_MENU_SPEC_PATH;
    const result = await runLabSession({
      definition,
      repoRoot,
      runtimeApiUrl: stack.apiUrl,
    });

    for (const observation of result.observations) {
      const metrics = Object.entries(observation.metrics)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');
      console.error(
        `  observation: ${observation.meta.status}: ${observation.profileId}/${observation.scenarioId} ${metrics}`,
      );
    }

    if (result.failures > 0) {
      throw new Error(`${result.failures} Euro menu observation(s) failed`);
    }

    return result;
  } finally {
    console.error('\nStopping stack...');
    await stack.stop();
  }
}

const stackMode = process.argv.includes('--docker')
  ? 'docker'
  : process.argv.includes('--local')
    ? 'local'
    : undefined;

if (!stackMode) {
  console.error('Pass --docker or --local');
  process.exit(1);
}

runEuroMenuProbe(stackMode).catch((err) => {
  console.error(err);
  process.exit(1);
});
