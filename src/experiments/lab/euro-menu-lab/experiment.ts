#!/usr/bin/env node
/**
 * Euro hamburger menu — full methodology lab with the primary local headless runtime.
 *
 * Same 4 cache/network profiles and gate as euro-cwv-lab, but only
 * scenario-euro-open-menu (4 profiles × 10 replicates = 40 steps).
 *
 *   npm run bench:euro:menu
 *   BENCH_REPLICATES=100 npm run bench:euro:menu
 *   npx tsx src/experiments/lab/euro-menu-lab/experiment.ts
 */
import { EURO_MENU_SCENARIO_ID } from '../euro-cwv-lab/definition';
import { runEuroExperiment, type RunEuroExperimentOptions } from '../euro-cwv-lab/experiment';

export async function runEuroMenuLab(options: Omit<RunEuroExperimentOptions, 'scenarioIds' | 'title'> = {}) {
  return runEuroExperiment({
    ...options,
    title: 'Euro menu lab',
    scenarioIds: [EURO_MENU_SCENARIO_ID],
  });
}

if (require.main === module) {
  runEuroMenuLab().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
