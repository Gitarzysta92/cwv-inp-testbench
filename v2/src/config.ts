export const lab = {
  cohort: {
    hostClass: 'local-headless',
    appVersion: 'abc123',
  },
  methodology: {
    replicates: 5,
    /** @see v2/README.md#run-schedule */
    schedule: 'interleave' as const,
    metric: 'inpMs',
    percentiles: [50, 75, 95],
    trimExtremesPercent: 10,
    gate: {
      acceptableDeltaMs: 40,
    },
  },
};


export const profiles = [
  {
    id: 'baseline',
    label: 'Desktop cold, no targeted slowdown',
    role: 'baseline' as const,
    warmup: 'cold' as const,
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
    route: '/scenario/a',
  },
  {
    id: 'scenario-b-fourth-filter',
    label: 'B — 4th category filter',
    route: '/scenario/b',
  },
  {
    id: 'scenario-c-search-typing',
    label: 'C — search typing',
    route: '/scenario/c',
  },
  {
    id: 'scenario-d-cart-plus',
    label: 'D — cart plus',
    route: '/scenario/d',
  },
];
