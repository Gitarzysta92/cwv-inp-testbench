import type { LabDefinition, Profile } from '../lab/types';
import { EURO_APP_URL, EURO_BLOCK_SCRIPT_PATTERNS, euroLiveProfile } from './euro-offline-replay-fixtures';

export const EURO_MENU_SCENARIO_ID = 'scenario-euro-open-menu';
export const EURO_MENU_SPEC_PATH = 'src/scenarios/playwright-web-vitals/euro-open-menu.spec.ts';

const profileBase = {
  network: {
    kind: 'live' as const,
    baseUrl: EURO_APP_URL,
  },
};

export const euroMenuMethodologyProfiles: Profile[] = [
  euroLiveProfile({
    ...profileBase,
    id: 'baseline',
    label: 'Euro menu - browser cache warmed',
    role: 'baseline',
    warmup: 'warm_assets',
    network: {
      ...profileBase.network,
      browserCache: 'default',
      runtimeNetworkCache: 'default',
    },
  }),
  euroLiveProfile({
    ...profileBase,
    id: 'euro-menu-browser-cache-cold',
    label: 'Euro menu - browser cache cold',
    role: 'measurement',
    warmup: 'cold',
    network: {
      ...profileBase.network,
      browserCache: 'default',
      runtimeNetworkCache: 'default',
    },
  }),
  euroLiveProfile({
    ...profileBase,
    id: 'euro-menu-browser-cache-disabled',
    label: 'Euro menu - browser cache disabled',
    role: 'measurement',
    warmup: 'cold',
    network: {
      ...profileBase.network,
      browserCache: 'disabled',
      runtimeNetworkCache: 'disabled',
    },
  }),
  euroLiveProfile({
    ...profileBase,
    id: 'euro-menu-external-scripts-blocked-warm',
    label: 'Euro menu - external scripts blocked with warmed cache',
    role: 'measurement',
    warmup: 'warm_assets',
    network: {
      ...profileBase.network,
      blockScripts: EURO_BLOCK_SCRIPT_PATTERNS,
      browserCache: 'default',
      runtimeNetworkCache: 'default',
    },
  }),
];

export const euroMenuMethodologyLab: LabDefinition = {
  lab: {
    cohort: {
      hostClass: 'runtime-docker-isolated',
      appVersion: 'dev',
    },
    methodology: {
      replicates: 5,
      schedule: 'interleave',
      metric: 'inpMs',
      percentiles: [50, 75, 95],
      trimExtremesPercent: 10,
      gate: {
        baselineProfileId: 'baseline',
        acceptableDeltaMs: 40,
      },
    },
    client: 'playwright-web-vitals',
  },
  profiles: euroMenuMethodologyProfiles,
  scenarios: [
    {
      id: EURO_MENU_SCENARIO_ID,
      label: 'Euro open main menu',
      description: [
        'Prepare isolated runtime container',
        'Apply profile cache policy',
        'Open the Euro main menu',
        'Measure INP through web-vitals/onINP',
      ],
    },
  ],
};
