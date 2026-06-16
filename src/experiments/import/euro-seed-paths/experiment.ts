#!/usr/bin/env node
/**
 * Import Euro lab measurements (3 paths × 3 days) into bench-results/.
 *
 *   npm run bench:seed-euro-paths
 *
 * Fill SEARCH_ROWS / ROTATOR_ROWS in measurements.ts when you have raw data.
 */
import { PATH_CONFIGS, SESSION_DAYS } from './measurements';
import { seedDay } from './publish';

export { seedDay } from './publish';
export {
  HAMBURGER_ROWS,
  PATH_CONFIGS,
  ROTATOR_ROWS,
  SEARCH_ROWS,
  SESSION_DAYS,
} from './measurements';

export function runEuroSeedPaths(repoRoot: string = process.cwd()): void {
  for (const day of SESSION_DAYS) {
    seedDay(repoRoot, day.sessionId, day.date, PATH_CONFIGS);
  }

  console.error('\nDone. Sessions (3 ścieżki w jednej sesji/dzień):');
  for (const day of SESSION_DAYS) {
    console.error(`  - ${day.sessionId} (${day.date.slice(0, 10)})`);
    console.error(
      `    → bench-results/euro-paths/${day.sessionId.replace('euro-paths-', '')}/jira-copy-paste.txt`,
    );
  }

  const missing = PATH_CONFIGS.filter((p) => p.rows.length === 0).map((p) => p.jiraTitle);
  if (missing.length > 0) {
    console.error('\nUwaga: brak surowych danych dla:', missing.join(', '));
    console.error('Uzupełnij SEARCH_ROWS / ROTATOR_ROWS w src/experiments/import/euro-seed-paths/measurements.ts i uruchom ponownie.');
  }
}

runEuroSeedPaths();
