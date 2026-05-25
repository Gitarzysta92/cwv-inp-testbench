import type { LabDefinition } from './lab/types';

export const lab = {
  cohort: {
    hostClass: 'local-headless',
    appVersion: 'dev',
  },
  methodology: {
    replicates: 5,
    schedule: 'interleave' as const,
    metric: 'inpMs',
    percentiles: [50, 75, 95],
    trimExtremesPercent: 10,
    gate: {
      baselineProfileId: 'baseline',
      acceptableDeltaMs: 40,
    },
  },
  client: 'playwright-web-vitals' as const,
};

export const profiles = [
  {
    id: 'baseline',
    label: 'Desktop cold, no targeted slowdown',
    role: 'baseline' as const,
    warmup: 'cold' as const,
    network: {
      kind: 'mock-static' as const,
      baseUrl: 'http://localhost:4200',
      blockScripts: ['/assets/scripts/analytics.js'],
    },
    device: {
      width: 1280,
      height: 720,
    },
    system: {
      timezoneId: 'UTC',
      locale: 'en-US',
    },
    browser: {
      engine: 'chromium',
      project: 'Desktop Chrome',
      headless: true,
      freshContextPerRun: true,
    },
    application: {
      apiMode: 'mocked',
      payloads: 'fixed-fixtures',
      images: 'deterministic-data-urls',
      serveMode: 'static-dist-or-ng-serve',
      featureFlags: 'fixed-defaults',
    },
  },
];

export const scenarios = [
  {
    id: 'scenario-a-first-thumb',
    label: 'A — gallery thumbnail',
    description: [
      'Open product page',
      'Wait idle',
      'Click gallery thumbnail',
      'Measure interaction',
    ],
  },
  {
    id: 'scenario-b-fourth-filter',
    label: 'B — 4th category filter',
    description: [
      'Open homepage',
      'Go to category',
      'Scroll listing',
      'Apply filters 1–3',
      'Measure: click 4th filter',
    ],
  },
  {
    id: 'scenario-c-search-typing',
    label: 'C — search typing',
    description: [
      'Open homepage',
      'Open search',
      'Type search phrase',
      'Measure key interactions',
    ],
  },
  {
    id: 'scenario-d-cart-plus',
    label: 'D — cart plus',
    description: [
      'Browse category',
      'Add product',
      'Open cart',
      'Click +',
      'Measure INP',
    ],
  },
];

export const labDefinition: LabDefinition = {
  lab,
  profiles,
  scenarios,
};
