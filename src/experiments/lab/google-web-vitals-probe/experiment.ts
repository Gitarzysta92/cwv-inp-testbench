#!/usr/bin/env node
/**
 * Google web-vitals probe on live Google homepage.
 *
 *   npx tsx src/experiments/lab/google-web-vitals-probe/experiment.ts --docker
 *   npx tsx src/experiments/lab/google-web-vitals-probe/experiment.ts --local
 */
import * as path from 'path';
import { runLabSession, type RunLabSessionResult } from '../../../orchestrator/run-lab-session';
import { upDockerStack, upLocalStack } from '../../../runtime/tests/stack';
import { GOOGLE_APP_URL } from './profiles';
import {
  GOOGLE_WEB_VITALS_SCENARIO_ID,
  GOOGLE_WEB_VITALS_SPEC_PATH,
  googleWebVitalsProbeLab,
} from './definition';

export { GOOGLE_APP_URL, GOOGLE_BLOCK_SCRIPT_PATTERNS, googleLiveProfile } from './profiles';
export {
  GOOGLE_WEB_VITALS_SCENARIO_ID,
  GOOGLE_WEB_VITALS_PROFILE_ID,
  GOOGLE_WEB_VITALS_SPEC_PATH,
  googleWebVitalsProbeLab,
} from './definition';

export type StackMode = 'docker' | 'local';

function readReplicates(): number {
  const raw = Number(process.env['BENCH_REPLICATES'] ?? 1);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
}

export async function runGoogleWebVitalsProbe(stackMode: StackMode): Promise<RunLabSessionResult> {
  const repoRoot = path.resolve(process.cwd());
  const definition = googleWebVitalsProbeLab(readReplicates());

  console.error('\nGoogle web-vitals probe');
  console.error(`  app:        ${GOOGLE_APP_URL}`);
  console.error(`  client:     ${definition.lab.client}`);
  console.error(`  scenario:   ${GOOGLE_WEB_VITALS_SCENARIO_ID}`);
  console.error(`  spec:       ${GOOGLE_WEB_VITALS_SPEC_PATH}`);
  console.error(`  replicates: ${definition.lab.methodology.replicates}\n`);

  const stack =
    stackMode === 'docker'
      ? await upDockerStack()
      : await upLocalStack({ appUrl: GOOGLE_APP_URL });

  try {
    process.env['BENCH_PLAYWRIGHT_SPEC'] = GOOGLE_WEB_VITALS_SPEC_PATH;
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
      throw new Error(`${result.failures} Google observation(s) failed`);
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

runGoogleWebVitalsProbe(stackMode).catch((err) => {
  console.error(err);
  process.exit(1);
});
