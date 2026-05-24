import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { resolveClient } from '../../lab/client-catalog';
import { prepareClientEnv } from '../prepare-env';
import type { ClientRunInput, RunnerResult } from '../types';

export class PlaywrightRunner {
  readonly clientId = 'playwright-web-vitals' as const;

  async spawn(input: ClientRunInput): Promise<RunnerResult> {
    const catalog = resolveClient(this.clientId);
    const invocationId = randomUUID();
    const legacyRawDir = path.join(input.observationsDir, '_playwright-invocations');
    fs.mkdirSync(legacyRawDir, { recursive: true });

    const profile = input.definition.profiles.find((p) => p.id === input.step.profileId)!;
    const spec =
      process.env['BENCH_PLAYWRIGHT_SPEC'] ??
      'src/scenarios/playwright-web-vitals/scenarios-a-d.spec.ts';
    const config =
      process.env['BENCH_PLAYWRIGHT_CONFIG'] ??
      'src/clients/playwright-web-vitals/playwright.config.ts';

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...input.runtime.env,
      ...prepareClientEnv(profile),
      PLAYWRIGHT_BASE_URL: input.runtime.baseUrl,
      BENCH_ORCHESTRATED: '1',
      BENCH_RESULTS_DIR: legacyRawDir,
      BENCH_CONFIG_ID: input.step.profileId,
      BENCH_CONFIG_LABEL:
        input.definition.profiles.find((p) => p.id === input.step.profileId)?.label ??
        input.step.profileId,
      BENCH_RUN_INDEX: String(input.step.replicate),
      BENCH_INVOCATION_ID: invocationId,
      BENCH_SCENARIO_ID: input.step.scenarioId,
    };

    if (input.runtime.env['BROWSER_CDP_URL']) {
      env['BENCH_BROWSER_CONNECT_MODE'] = 'cdp';
      env['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1';
      env['PLAYWRIGHT_SKIP_WEBSERVER'] = '1';
    }

    if (input.runtime.network.kind === 'live') {
      env['PLAYWRIGHT_SKIP_WEBSERVER'] = '1';
    }

    const result = spawnSync('npx', ['playwright', 'test', spec, '--config', config], {
      cwd: input.repoRoot,
      env,
      stdio: 'inherit',
      shell: false,
    });

    const artifactPath = path.join(
      legacyRawDir,
      `${input.step.profileId}-run${input.step.replicate}-${invocationId}.json`,
    );

    return {
      exitCode: result.status ?? 1,
      invocationArtifactPath: fs.existsSync(artifactPath) ? artifactPath : undefined,
    };
  }
}
