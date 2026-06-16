#!/usr/bin/env node
/**
 * Euro runtime CDP smoke test — capture + offline replay without lab orchestration.
 *
 *   npx tsx src/experiments/runtime/euro-offline-replay/experiment.ts --docker
 *   npx tsx src/experiments/runtime/euro-offline-replay/experiment.ts --local
 */
import { RUNTIME_API_SCHEMA } from '../../../runtime/api/types';
import { RuntimeTestClient } from '../../../runtime/tests/runtime-client';
import { upDockerStack, upLocalStack } from '../../../runtime/tests/stack';
import { EURO_APP_URL, EURO_BLOCK_SCRIPT_PATTERNS } from '../../lab/euro-cwv-lab/profiles';
import { runEuroOfflineReplaySmoke } from './run';

export type StackMode = 'docker' | 'local';

export async function runEuroOfflineReplayExperiment(stackMode?: StackMode): Promise<void> {
  console.error('\nEuro offline replay');
  console.error(`  schema: ${RUNTIME_API_SCHEMA}`);
  console.error(`  app:    ${EURO_APP_URL}`);
  console.error(`  block:  ${EURO_BLOCK_SCRIPT_PATTERNS.join(', ')}\n`);

  let stack: Awaited<ReturnType<typeof upDockerStack>> | undefined;
  let client: RuntimeTestClient;

  if (stackMode === 'docker') {
    console.error('Starting Docker stack…\n');
    stack = await upDockerStack();
    client = new RuntimeTestClient({ apiUrl: stack.apiUrl, cdpUrl: stack.cdpUrl });
  } else if (stackMode === 'local') {
    console.error('Starting local stack…\n');
    stack = await upLocalStack({ appUrl: EURO_APP_URL });
    client = new RuntimeTestClient({ apiUrl: stack.apiUrl, cdpUrl: stack.cdpUrl });
  } else {
    client = new RuntimeTestClient();
    await client.waitForReady();
  }

  console.error(`  API: ${client.apiUrl}`);
  console.error(`  CDP: ${client.cdpUrl}\n`);

  try {
    const results = await runEuroOfflineReplaySmoke(client);
    const failed = results.filter((result) => !result.ok);
    console.error(`\n${results.length - failed.length}/${results.length} passed`);
    if (failed.length) {
      failed.forEach((result) => console.error(`  FAIL: ${result.name} — ${result.detail}`));
      throw new Error(`${failed.length} check(s) failed`);
    }
  } finally {
    if (stack) {
      console.error('\nStopping stack…');
      await stack.stop();
    }
  }
}

const stackMode = process.argv.includes('--docker')
  ? 'docker'
  : process.argv.includes('--local')
    ? 'local'
    : undefined;

runEuroOfflineReplayExperiment(stackMode).catch((err) => {
  console.error(err);
  process.exit(1);
});
