import type { BenchSchedule, ClientId, ExecutionStep, LabDefinition, Scenario, SessionStep } from './types';

export function buildExecutionPlan(
  profileIds: readonly string[],
  replicates: number,
  schedule: BenchSchedule,
): ExecutionStep[] {
  if (profileIds.length === 0 || replicates < 1) return [];

  const steps: ExecutionStep[] = [];
  let stepIndex = 0;

  if (schedule === 'sequential') {
    for (const profileId of profileIds) {
      for (let replicate = 0; replicate < replicates; replicate++) {
        steps.push({ profileId, replicate, stepIndex: stepIndex++ });
      }
    }
    return steps;
  }

  for (let replicate = 0; replicate < replicates; replicate++) {
    for (const profileId of profileIds) {
      steps.push({ profileId, replicate, stepIndex: stepIndex++ });
    }
  }
  return steps;
}

/** profile × replicate × scenarios; client comes from lab.client. */
export function buildSessionPlan(input: {
  executionPlan: ExecutionStep[];
  scenarios: Scenario[];
  clientId: ClientId;
}): SessionStep[] {
  const { executionPlan, scenarios, clientId } = input;
  const session: SessionStep[] = [];
  let sessionStepIndex = 0;

  for (const step of executionPlan) {
    for (const scenario of scenarios) {
      session.push({
        ...step,
        clientId,
        scenarioId: scenario.id,
        sessionStepIndex: sessionStepIndex++,
      });
    }
  }

  return session;
}

export function clientIdsFromLab(definition: LabDefinition): ClientId[] {
  return [definition.lab.client];
}
