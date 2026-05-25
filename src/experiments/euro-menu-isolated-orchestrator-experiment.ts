#!/usr/bin/env node
/**
 * Euro.com.pl menu/listing experiment using orchestrator scheduling.
 *
 * The orchestrator expands profiles x scenarios x runReplay into flat
 * instructions, then starts a fresh runtime Docker container for each one.
 *
 *   npx tsx src/experiments/euro-menu-isolated-orchestrator-experiment.ts
 */
import * as path from 'path';
import type { LabDefinition, Observation } from '../lab/types';
import { runLabSession, type RuntimeApiLease } from '../orchestrator/run-lab-session';
import type { OrchestratorRunInstruction } from '../orchestrator/scheduler';
import { RuntimeApiClient } from '../orchestrator/runtime-api-client';
import { upDockerStack } from '../runtime/tests/stack';
import { euroMenuMethodologyLab } from './euro-menu-methodology-lab';

function readReplicates(): number {
  const raw = Number(process.env['BENCH_REPLICATES'] ?? euroMenuMethodologyLab.lab.methodology.replicates);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : euroMenuMethodologyLab.lab.methodology.replicates;
}

function definition(): LabDefinition {
  return {
    ...euroMenuMethodologyLab,
    lab: {
      ...euroMenuMethodologyLab.lab,
      cohort: {
        ...euroMenuMethodologyLab.lab.cohort,
        appVersion: process.env['GIT_SHA'] ?? euroMenuMethodologyLab.lab.cohort.appVersion,
      },
      methodology: {
        ...euroMenuMethodologyLab.lab.methodology,
        replicates: readReplicates(),
      },
    },
  };
}

function describeObservation(observation: Observation): string {
  return [
    observation.meta.status,
    `${observation.profileId}/${observation.scenarioId}`,
    `runReplay=${observation.runReplay}`,
    `inp=${observation.metrics['inpMs'] ?? 'n/a'}`,
    `event=${observation.metrics['eventTimingMaxMs'] ?? 'n/a'}`,
    `wall=${observation.metrics['wallClockMs'] ?? 'n/a'}`,
  ].join(' ');
}

async function startRuntimeForInstruction(input: {
  definition: LabDefinition;
  sessionId: string;
  instruction: OrchestratorRunInstruction;
  buildImage: boolean;
}): Promise<RuntimeApiLease> {
  const containerName = `cwv-runtime-${input.sessionId.slice(0, 8)}-${input.instruction.instructionIndex}`;
  const profile = input.definition.profiles.find(
    (candidate) => candidate.id === input.instruction.profileId,
  );
  if (!profile) {
    throw new Error(`unknown profile "${input.instruction.profileId}"`);
  }

  const runtimeEnv: Record<string, string> = profile.browser.headless
    ? {}
    : {
        BENCH_USE_XVFB: '1',
        BROWSER_HEADLESS: '0',
        XVFB_WIDTH: String(profile.device.width),
        XVFB_HEIGHT: String(profile.device.height),
      };

  const stack = await upDockerStack({
    containerName,
    build: input.buildImage,
    env: runtimeEnv,
  });

  return {
    client: new RuntimeApiClient({ baseUrl: stack.apiUrl }),
    description: `docker:${containerName}`,
    close: stack.stop,
  };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.cwd());
  const labDefinition = definition();
  const instructionCount =
    labDefinition.profiles.length *
    labDefinition.scenarios.length *
    labDefinition.lab.methodology.replicates;

  console.error('\nEuro menu/listing isolated orchestrator experiment');
  console.error(`  scenarios:  ${labDefinition.scenarios.map((scenario) => scenario.id).join(', ')}`);
  console.error(
    `  specs:      ${labDefinition.scenarios
      .map((scenario) => `${scenario.id}=${scenario.specPath ?? '<default>'}`)
      .join(', ')}`,
  );
  console.error(`  profiles:   ${labDefinition.profiles.map((profile) => profile.id).join(', ')}`);
  console.error(`  runReplay:  ${labDefinition.lab.methodology.replicates}`);
  console.error(`  schedule:   ${labDefinition.lab.methodology.schedule}`);
  console.error(`  steps:      ${instructionCount}`);
  console.error('  runtime:    fresh Docker container per instruction\n');

  let imageBuilt = false;
  const result = await runLabSession({
    definition: labDefinition,
    repoRoot,
    runtimeApiFactory: async ({ sessionId, instruction }) => {
      const lease = await startRuntimeForInstruction({
        definition: labDefinition,
        sessionId,
        instruction,
        buildImage: !imageBuilt,
      });
      imageBuilt = true;
      return lease;
    },
  });

  for (const observation of result.observations) {
    console.error(`  observation: ${describeObservation(observation)}`);
  }

  console.error(`  summary rows: ${result.report.summary.length}`);

  if (result.failures > 0) {
    throw new Error(`${result.failures} Euro menu observation(s) failed`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
