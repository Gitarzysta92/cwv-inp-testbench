#!/usr/bin/env node
/** @deprecated Prefer npm run bench:seed-euro-paths */
import { EURO_MENU_SCENARIO_ID } from '../../lab/euro-cwv-lab/definition';
import { HAMBURGER_ROWS, SESSION_DAYS } from '../euro-seed-paths/measurements';
import { seedDay, type PathSeedConfig } from '../euro-seed-paths/publish';

const menuOnly: PathSeedConfig[] = [
  {
    key: 'hamburger',
    scenarioId: EURO_MENU_SCENARIO_ID,
    scenarioLabel: 'Euro hamburger menu click',
    jiraTitle: 'Euro / Hamburger Menu',
    rows: HAMBURGER_ROWS,
  },
];

const repoRoot = process.cwd();
for (const day of SESSION_DAYS) {
  const legacyId = day.sessionId.replace('euro-paths-', 'euro-menu-');
  seedDay(repoRoot, legacyId, day.date, menuOnly, { resultsSubdir: 'euro-menu' });
}

console.error('Legacy import (menu only). Prefer: npm run bench:seed-euro-paths');
