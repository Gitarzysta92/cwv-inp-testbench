#!/usr/bin/env node
/**
 * Euro CWV lab — profiles × scenarios × replicates via isolated Docker runtime.
 *
 *   npm run bench:euro
 *   BENCH_REPLICATES=100 npm run bench:euro
 *   npx tsx src/experiments/lab/euro-cwv-lab/experiment.ts
 */
import * as path from 'path';
import type { LabDefinition, Observation } from '../../../lab/types';
import { runLabSession, type RunLabSessionResult, type RuntimeApiLease } from '../../../orchestrator/run-lab-session';
import type { OrchestratorRunInstruction } from '../../../orchestrator/scheduler';
import { RuntimeApiClient } from '../../../orchestrator/runtime-api-client';
import type { BenchRuntime } from '../../../runtime';
import { dockerHeadfulXvfbRuntime } from '../../../runtime';
import { euroMenuMethodologyLab } from './definition';

export { euroMenuMethodologyLab, euroMenuMethodologyProfiles } from './definition';
export { EURO_APP_URL, EURO_BLOCK_SCRIPT_PATTERNS, euroLiveProfile } from './profiles';

export type RunEuroExperimentOptions = {
  repoRoot?: string;
  replicates?: number;
  scenarioIds?: string[];
  title?: string;
  runtime?: BenchRuntime;
};

function readReplicates(defaultReplicates: number): number {
  const raw = Number(process.env['BENCH_REPLICATES'] ?? defaultReplicates);
  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : defaultReplicates;
}

function selectScenarios(
  allScenarios: LabDefinition['scenarios'],
  requestedIds: string[],
): LabDefinition['scenarios'] {
  const selected = allScenarios.filter((scenario) => requestedIds.includes(scenario.id));
  const unknown = requestedIds.filter((id) => !allScenarios.some((scenario) => scenario.id === id));
  if (unknown.length > 0) {
    throw new Error(`unknown scenario(s): ${unknown.join(', ')}`);
  }
  if (selected.length === 0) {
    throw new Error('no scenarios selected');
  }
  return selected;
}

export function resolveEuroLabDefinition(options: Pick<RunEuroExperimentOptions, 'replicates' | 'scenarioIds'> = {}): LabDefinition {
  const resolvedReplicates = options.replicates ?? readReplicates(euroMenuMethodologyLab.lab.methodology.replicates);
  const scenarios = options.scenarioIds?.length
    ? selectScenarios(euroMenuMethodologyLab.scenarios, options.scenarioIds)
    : euroMenuMethodologyLab.scenarios;

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
        replicates: resolvedReplicates,
      },
    },
    scenarios,
  };
}

function applyRuntimeToLabDefinition(definition: LabDefinition, runtime: BenchRuntime): LabDefinition {
  return {
    ...definition,
    lab: {
      ...definition.lab,
      cohort: {
        ...definition.lab.cohort,
        hostClass: runtime.hostClass,
      },
    },
    profiles: definition.profiles.map((profile) => {
      const runtimeProfile = {
        ...profile,
        browser: {
          ...profile.browser,
          headless: runtime.browserHeadless,
        },
      };
      return runtime.configureProfile?.(runtimeProfile) ?? runtimeProfile;
    }),
  };
}

function describeObservation(observation: Observation): string {
  return [
    observation.meta.status,
    `${observation.profileId}/${observation.scenarioId}`,
    `runReplay=${observation.runReplay}`,
    `inp=${observation.metrics['inpMs'] ?? 'n/a'}`,
    `event=${observation.metrics['eventTimingMaxMs'] ?? 'n/a'}`,
    `duration=${observation.metrics['scenarioDurationMs'] ?? 'n/a'}`,
  ].join(' ');
}

async function startRuntimeForInstruction(input: {
  definition: LabDefinition;
  sessionId: string;
  instruction: OrchestratorRunInstruction;
  buildImage: boolean;
  runtime: BenchRuntime;
}): Promise<RuntimeApiLease> {
  const profile = input.definition.profiles.find(
    (candidate) => candidate.id === input.instruction.profileId,
  );
  if (!profile) {
    throw new Error(`unknown profile "${input.instruction.profileId}"`);
  }

  const started = await input.runtime.start({
    profile,
    sessionId: input.sessionId,
    instructionIndex: input.instruction.instructionIndex,
    buildImage: input.buildImage,
  });

  return {
    client: new RuntimeApiClient({ baseUrl: started.apiUrl }),
    description: started.description,
    close: started.close,
  };
}

export async function runEuroExperiment(options: RunEuroExperimentOptions = {}): Promise<RunLabSessionResult> {
  const repoRoot = options.repoRoot ?? path.resolve(process.cwd());
  const runtime = options.runtime ?? dockerHeadfulXvfbRuntime;
  const labDefinition = applyRuntimeToLabDefinition(
    resolveEuroLabDefinition({
      replicates: options.replicates,
      scenarioIds: options.scenarioIds,
    }),
    runtime,
  );
  const instructionCount =
    labDefinition.profiles.length *
    labDefinition.scenarios.length *
    labDefinition.lab.methodology.replicates;

  console.error(`\n${options.title ?? 'Euro CWV lab'}`);
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
  console.error(`  runtime:    ${runtime.id} (${runtime.label}); fresh instance per instruction\n`);

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
        runtime,
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
    throw new Error(`${result.failures} Euro observation(s) failed`);
  }

  return result;
}

if (require.main === module) {
  runEuroExperiment().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
