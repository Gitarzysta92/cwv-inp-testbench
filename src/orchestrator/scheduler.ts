import type { BenchSchedule, ClientId, LabDefinition, Profile, Scenario, SessionStep } from '../lab/types';

export type RuntimeSetupKind = 'local-process' | 'shared-runtime-api' | 'isolated-runtime-api';

export type RuntimeSetupInstruction = {
  kind: RuntimeSetupKind;
  isolationKey: string;
  profileId: string;
  scenarioId: string;
  runReplay: number;
};

export type OrchestratorRunInstruction = SessionStep & {
  instructionIndex: number;
  runtime: RuntimeSetupInstruction;
};

export type BuildOrchestratorScheduleInput = {
  profiles: readonly Pick<Profile, 'id'>[];
  scenarios: readonly Pick<Scenario, 'id'>[];
  clientId: ClientId;
  runReplays: number;
  schedule: BenchSchedule;
  runtimeSetup: {
    kind: RuntimeSetupKind;
  };
};

function runtimeIsolationKey(kind: RuntimeSetupKind, instructionIndex: number): string {
  if (kind === 'isolated-runtime-api') {
    return `instruction-${instructionIndex}`;
  }
  return kind;
}

function appendInstruction(
  instructions: OrchestratorRunInstruction[],
  input: BuildOrchestratorScheduleInput,
  profileId: string,
  scenarioId: string,
  runReplay: number,
): void {
  const instructionIndex = instructions.length;
  instructions.push({
    profileId,
    scenarioId,
    runReplay,
    replicate: runReplay,
    stepIndex: instructionIndex,
    sessionStepIndex: instructionIndex,
    clientId: input.clientId,
    instructionIndex,
    runtime: {
      kind: input.runtimeSetup.kind,
      isolationKey: runtimeIsolationKey(input.runtimeSetup.kind, instructionIndex),
      profileId,
      scenarioId,
      runReplay,
    },
  });
}

/**
 * Expand orchestrator work into a flat instruction list.
 *
 * The scheduler does not calculate methodology output. It only turns
 * profiles x scenarios x runReplay into concrete work items and attaches the
 * runtime setup shape needed for each item.
 */
export function buildOrchestratorSchedule(
  input: BuildOrchestratorScheduleInput,
): OrchestratorRunInstruction[] {
  if (!input.profiles.length || !input.scenarios.length || input.runReplays < 1) {
    return [];
  }

  const instructions: OrchestratorRunInstruction[] = [];
  const runReplays = Math.floor(input.runReplays);

  if (input.schedule === 'interleave') {
    for (let runReplay = 0; runReplay < runReplays; runReplay++) {
      for (const profile of input.profiles) {
        for (const scenario of input.scenarios) {
          appendInstruction(instructions, input, profile.id, scenario.id, runReplay);
        }
      }
    }
    return instructions;
  }

  for (const profile of input.profiles) {
    for (const scenario of input.scenarios) {
      for (let runReplay = 0; runReplay < runReplays; runReplay++) {
        appendInstruction(instructions, input, profile.id, scenario.id, runReplay);
      }
    }
  }
  return instructions;
}

export function buildScheduleForLab(
  definition: LabDefinition,
  runtimeSetup: { kind: RuntimeSetupKind },
): OrchestratorRunInstruction[] {
  return buildOrchestratorSchedule({
    profiles: definition.profiles,
    scenarios: definition.scenarios,
    clientId: definition.lab.client,
    runReplays: definition.lab.methodology.replicates,
    schedule: definition.lab.methodology.schedule,
    runtimeSetup,
  });
}
