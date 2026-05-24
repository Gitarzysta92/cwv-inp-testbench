import type { BenchSchedule, ExecutionStep } from './types';

/**
 * Expands lab.methodology into an ordered run list for the orchestrator.
 *
 * - sequential: all replicates of profile A, then all of profile B (v1 orchestrator behaviour).
 * - interleave: round-robin across profiles each replicate — balances device drift / thermal noise
 *   when comparing profiles (baseline vs slow) on the same host.
 */
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
