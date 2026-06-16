import type { BenchRuntime } from '../../../runtime';
import { EURO_MENU_SCENARIO_ID } from '../../lab/euro-cwv-lab/definition';
import {
  runEuroExperiment,
  type RunEuroExperimentOptions,
} from '../../lab/euro-cwv-lab/experiment';

export async function runEuroMenuRuntimeExperiment(
  runtime: BenchRuntime,
  options: Omit<RunEuroExperimentOptions, 'runtime' | 'scenarioIds' | 'title'> = {},
) {
  return runEuroExperiment({
    ...options,
    runtime,
    title: `Euro menu lab - ${runtime.label}`,
    scenarioIds: [EURO_MENU_SCENARIO_ID],
  });
}
