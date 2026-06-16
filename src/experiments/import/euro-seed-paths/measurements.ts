import {
  EURO_MENU_SCENARIO_ID,
  EURO_ROTATOR_BANNER_CLICK_SCENARIO_ID,
  EURO_SEARCH_LAYER_SCENARIO_ID,
} from '../../lab/euro-cwv-lab/definition';

export type RawRow = {
  profileId: string;
  replicate: number;
  inpMs: number;
  wallClockMs: number;
  /** Optional extra column from lab export (between wallClock and replay). */
  auxMs?: number;
  replayTotal: number;
  replayServed: number;
  replayBlocked: number;
  replayContinued: number;
  runtimeCacheEnabled: boolean;
};

export type PathSeedConfig = {
  key: 'hamburger' | 'search' | 'rotator';
  scenarioId: string;
  scenarioLabel: string;
  jiraTitle: string;
  rows: RawRow[];
};

/** Hamburger — import z pomiarów 26–28.05 (n=5). */
export const HAMBURGER_ROWS: RawRow[] = [
  { profileId: 'baseline', replicate: 0, inpMs: 40, wallClockMs: 2212, auxMs: 825, replayTotal: 192, replayServed: 153, replayBlocked: 39, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 1, inpMs: 32, wallClockMs: 2856, auxMs: 842, replayTotal: 204, replayServed: 162, replayBlocked: 42, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 2, inpMs: 32, wallClockMs: 2863, auxMs: 873, replayTotal: 205, replayServed: 161, replayBlocked: 44, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 3, inpMs: 40, wallClockMs: 2191, auxMs: 818, replayTotal: 211, replayServed: 171, replayBlocked: 40, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 4, inpMs: 40, wallClockMs: 2775, auxMs: 823, replayTotal: 209, replayServed: 164, replayBlocked: 45, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 0, inpMs: 32, wallClockMs: 2374, auxMs: 822, replayTotal: 136, replayServed: 78, replayBlocked: 58, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 1, inpMs: 32, wallClockMs: 2207, auxMs: 836, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 2, inpMs: 48, wallClockMs: 2234, auxMs: 852, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 3, inpMs: 40, wallClockMs: 2202, auxMs: 828, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 4, inpMs: 40, wallClockMs: 2205, auxMs: 826, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 0, inpMs: 32, wallClockMs: 2827, auxMs: 814, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 1, inpMs: 40, wallClockMs: 2817, auxMs: 823, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 2, inpMs: 40, wallClockMs: 2879, auxMs: 820, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 3, inpMs: 32, wallClockMs: 2800, auxMs: 824, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 4, inpMs: 32, wallClockMs: 2788, auxMs: 823, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 0, inpMs: 24, wallClockMs: 2314, auxMs: 821, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 1, inpMs: 40, wallClockMs: 2188, auxMs: 827, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 2, inpMs: 32, wallClockMs: 2329, auxMs: 831, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 3, inpMs: 32, wallClockMs: 2153, auxMs: 822, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 4, inpMs: 40, wallClockMs: 2324, auxMs: 829, replayTotal: 135, replayServed: 129, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
];

/** Search layer — wygenerowane (+20 ms INP vs pierwsza wersja seed). */
export const SEARCH_ROWS: RawRow[] = [
  { profileId: 'baseline', replicate: 0, inpMs: 68, wallClockMs: 2288, auxMs: 831, replayTotal: 192, replayServed: 153, replayBlocked: 39, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 1, inpMs: 60, wallClockMs: 2912, auxMs: 848, replayTotal: 204, replayServed: 162, replayBlocked: 42, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 2, inpMs: 68, wallClockMs: 2920, auxMs: 879, replayTotal: 205, replayServed: 161, replayBlocked: 44, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 3, inpMs: 76, wallClockMs: 2248, auxMs: 824, replayTotal: 211, replayServed: 171, replayBlocked: 40, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 4, inpMs: 68, wallClockMs: 2832, auxMs: 829, replayTotal: 209, replayServed: 164, replayBlocked: 45, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 0, inpMs: 60, wallClockMs: 2438, auxMs: 828, replayTotal: 136, replayServed: 78, replayBlocked: 58, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 1, inpMs: 60, wallClockMs: 2271, auxMs: 842, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 2, inpMs: 76, wallClockMs: 2298, auxMs: 858, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 3, inpMs: 68, wallClockMs: 2266, auxMs: 834, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 4, inpMs: 68, wallClockMs: 2269, auxMs: 832, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 0, inpMs: 60, wallClockMs: 2891, auxMs: 820, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 1, inpMs: 68, wallClockMs: 2881, auxMs: 829, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 2, inpMs: 68, wallClockMs: 2943, auxMs: 826, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 3, inpMs: 60, wallClockMs: 2864, auxMs: 830, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 4, inpMs: 60, wallClockMs: 2852, auxMs: 829, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 0, inpMs: 60, wallClockMs: 2378, auxMs: 827, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 1, inpMs: 52, wallClockMs: 2252, auxMs: 833, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 2, inpMs: 60, wallClockMs: 2393, auxMs: 837, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 3, inpMs: 68, wallClockMs: 2217, auxMs: 828, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 4, inpMs: 52, wallClockMs: 2388, auxMs: 835, replayTotal: 135, replayServed: 129, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
];

/** Rotator banner — wygenerowane (+15 ms INP vs pierwsza wersja seed). */
export const ROTATOR_ROWS: RawRow[] = [
  { profileId: 'baseline', replicate: 0, inpMs: 47, wallClockMs: 2188, auxMs: 819, replayTotal: 192, replayServed: 153, replayBlocked: 39, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 1, inpMs: 39, wallClockMs: 2832, auxMs: 836, replayTotal: 204, replayServed: 162, replayBlocked: 42, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 2, inpMs: 47, wallClockMs: 2839, auxMs: 867, replayTotal: 205, replayServed: 161, replayBlocked: 44, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 3, inpMs: 55, wallClockMs: 2167, auxMs: 812, replayTotal: 211, replayServed: 171, replayBlocked: 40, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'baseline', replicate: 4, inpMs: 47, wallClockMs: 2751, auxMs: 817, replayTotal: 209, replayServed: 164, replayBlocked: 45, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 0, inpMs: 55, wallClockMs: 2350, auxMs: 816, replayTotal: 136, replayServed: 78, replayBlocked: 58, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 1, inpMs: 47, wallClockMs: 2183, auxMs: 830, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 2, inpMs: 55, wallClockMs: 2210, auxMs: 846, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 3, inpMs: 63, wallClockMs: 2178, auxMs: 822, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-cold', replicate: 4, inpMs: 47, wallClockMs: 2181, auxMs: 820, replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 0, inpMs: 39, wallClockMs: 2803, auxMs: 808, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 1, inpMs: 47, wallClockMs: 2793, auxMs: 817, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 2, inpMs: 47, wallClockMs: 2855, auxMs: 814, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 3, inpMs: 55, wallClockMs: 2776, auxMs: 818, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-browser-cache-disabled', replicate: 4, inpMs: 39, wallClockMs: 2764, auxMs: 817, replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0, runtimeCacheEnabled: false },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 0, inpMs: 39, wallClockMs: 2290, auxMs: 815, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 1, inpMs: 47, wallClockMs: 2164, auxMs: 821, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 2, inpMs: 39, wallClockMs: 2305, auxMs: 825, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 3, inpMs: 47, wallClockMs: 2129, auxMs: 816, replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0, runtimeCacheEnabled: true },
  { profileId: 'euro-menu-external-scripts-blocked-warm', replicate: 4, inpMs: 55, wallClockMs: 2300, auxMs: 823, replayTotal: 135, replayServed: 129, replayBlocked: 6, replayContinued: 0, runtimeCacheEnabled: true },
];

export const PATH_CONFIGS: PathSeedConfig[] = [
  {
    key: 'hamburger',
    scenarioId: EURO_MENU_SCENARIO_ID,
    scenarioLabel: 'Euro hamburger menu click',
    jiraTitle: 'Euro / Hamburger Menu',
    rows: HAMBURGER_ROWS,
  },
  {
    key: 'search',
    scenarioId: EURO_SEARCH_LAYER_SCENARIO_ID,
    scenarioLabel: 'Euro open search layer',
    jiraTitle: 'Euro / Search layer',
    rows: SEARCH_ROWS,
  },
  {
    key: 'rotator',
    scenarioId: EURO_ROTATOR_BANNER_CLICK_SCENARIO_ID,
    scenarioLabel: 'Euro rotator banner click',
    jiraTitle: 'Euro / Rotator banner',
    rows: ROTATOR_ROWS,
  },
];

export const SESSION_DAYS = [
  { sessionId: 'euro-paths-20260526', date: '2026-05-26T18:00:00.000Z' },
  { sessionId: 'euro-paths-20260527', date: '2026-05-27T18:00:00.000Z' },
  { sessionId: 'euro-paths-20260528', date: '2026-05-28T18:00:00.000Z' },
];
