/** When set by v2 orchestrator, only the matching scenario test runs. */
export function isScenarioSelected(scenarioId: string): boolean {
  const filter = process.env.BENCH_SCENARIO_ID?.trim();
  if (!filter) return true;
  return filter === scenarioId;
}
