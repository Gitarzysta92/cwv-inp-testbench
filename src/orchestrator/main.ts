#!/usr/bin/env node
import * as path from 'path';
import { labDefinition } from '../config.example';
import { downDockerRuntime, upDockerRuntime } from './docker-stack';
import { parseOrchestratorOptions } from './options';
import { runLabSession } from './run-lab-session';

const repoRoot = path.resolve(process.cwd());

async function main(): Promise<void> {
  const opts = parseOrchestratorOptions();
  let runtimeEndpoints: Awaited<ReturnType<typeof upDockerRuntime>> | undefined;

  try {
    if (opts.docker === 'manage') {
      console.error('Orchestrator: starting runtime container…\n');
      runtimeEndpoints = await upDockerRuntime({
        repoRoot,
        definition: labDefinition,
        composeFile: opts.composeFile,
        projectName: opts.projectName,
        build: opts.buildImages,
      });
    }

    const result = await runLabSession({
      definition: labDefinition,
      repoRoot,
      runtimeApiUrl: opts.runtimeApiUrl ?? runtimeEndpoints?.runtimeApiUrl,
      baseUrl: opts.baseUrl ?? runtimeEndpoints?.runtimeBaseUrl,
    });

    if (result.failures > 0) {
      console.error(`\nCompleted with ${result.failures} failed observation(s).`);
      process.exit(1);
    }
  } finally {
    if (opts.docker === 'manage') {
      console.error('\nOrchestrator: stopping runtime container…');
      await downDockerRuntime({
        repoRoot,
        definition: labDefinition,
        composeFile: opts.composeFile,
        projectName: opts.projectName,
      });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
