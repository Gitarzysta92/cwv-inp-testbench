/** How repeated orchestrator instructions are ordered in one cohort session. */
export type BenchSchedule = 'sequential' | 'interleave';

export type Cohort = {
  hostClass: string;
  appVersion: string;
};

export type MetricBoundary = {
  min: number;
  max: number;
};

export type Methodology = {
  replicates: number;
  schedule: BenchSchedule;
  metric: string;
  metricBoundaries: Partial<Record<string, MetricBoundary>>;
  gate: {
    baselineProfileId?: string;
    acceptableDeltaMs: number;
  };
};

export type Lab = {
  cohort: Cohort;
  methodology: Methodology;
  /** Bench client for this lab session (playwright-web-vitals, etc.). */
  client: ClientId;
};

export type ClientId = 'playwright-web-vitals' | 'puppeteer-lh-timespan';

export type WarmupPolicy = 'cold' | 'warm_assets' | 'warm_session';

/** Where HTML/assets come from — resolved to baseUrl for the browser process. */
export type NetworkTargetKind = 'mock-static' | 'dev-server' | 'live';

/** Runtime slice: network target, cache/warmup, application policy. */
export type RuntimeProfileSlice = {
  network: {
    /** Profile default; orchestration env (PLAYWRIGHT_BASE_URL) overrides at deploy time. */
    baseUrl?: string;
    kind: NetworkTargetKind;
    /** Optional sidecar proxy the browser should use (future: mitm/throttle container). */
    proxyUrl?: string;
    /** Script URL path patterns aborted in the browser (runtime policy). */
    blockScripts?: string[];
    /** Disable Chromium HTTP cache for the measured browser session. */
    browserCache?: 'default' | 'disabled';
    /** Runtime-managed response replay cache policy. */
    runtimeNetworkCache?: 'default' | 'disabled';
    /** Whether runtime replay cache misses are blocked locally or continue to live network. */
    runtimeCacheMissPolicy?: 'block' | 'continue';
  };
  warmup: WarmupPolicy;
  application: {
    apiMode: 'mocked' | 'live' | string;
    payloads: string;
    images: string;
    serveMode: string;
    featureFlags: string;
  };
  slowdown?: {
    clickByTestId?: Record<string, number>;
    keydownByTestId?: Record<string, number>;
  };
};

export type ProfileRole = 'baseline' | 'measurement' | 'calibration';

/** Client slice: browser, viewport, locale. */
export type ClientProfileSlice = {
  device: { width: number; height: number };
  system: { timezoneId: string; locale: string };
  browser: {
    engine: string;
    project: string;
    headless: boolean;
    freshContextPerRun: boolean;
  };
};

export type Profile = {
  id: string;
  label: string;
  role: ProfileRole;
} & RuntimeProfileSlice &
  ClientProfileSlice;

/** Thin scenario — human-readable catalog entry. */
export type Scenario = {
  id: string;
  label: string;
  description: string[];
  /** Optional client-specific Playwright spec path for this scenario. */
  specPath?: string;
};

export type ExecutionStep = {
  profileId: string;
  /** Orchestrator replay index for this profile/scenario instruction. */
  runReplay: number;
  /** Back-compat alias for persisted observation/report naming. */
  replicate: number;
  stepIndex: number;
};

export type SessionStep = ExecutionStep & {
  clientId: ClientId;
  scenarioId: string;
  sessionStepIndex: number;
};

export type ObservationStatus = 'ok' | 'missing_metric' | 'failed' | 'not_implemented';

export type ObservationNetworkStats = {
  policy: {
    blockedByPolicy: number;
    blockedRequests: Array<{
      url: string;
      method?: string;
      resourceType?: string;
      blockedReason?: string;
      errorText?: string;
    }>;
  };
  runtimeCache: {
    enabled: boolean;
    mode: 'replay' | 'disabled' | 'unavailable';
    missPolicy?: 'block' | 'continue';
    reason?: string;
    capture: {
      seen: number;
      stored: number;
      skipped: number;
      bodyReadFailed: number;
      cacheEntries: number;
    };
    replay: {
      totalPaused: number;
      servedFromCache: number;
      blockedCacheMisses: number;
      continuedToNetwork: number;
      fulfillFailures: number;
      allHandledLocally: boolean;
      allServedFromCache: boolean;
    };
    cacheMisses: string[];
    fulfillFailureMessages?: string[];
  };
};

export type Observation = {
  schema: 'cwv-bench-observation/1';
  sessionId: string;
  cohort: Cohort;
  profileId: string;
  profileLabel: string;
  scenarioId: string;
  scenarioLabel: string;
  runReplay: number;
  replicate: number;
  stepIndex: number;
  sessionStepIndex: number;
  clientId: ClientId;
  runtimeEnvironmentId: string;
  metrics: Partial<Record<string, number>>;
  meta: {
    status: ObservationStatus;
    primaryMetric: string;
    inpSource?: string;
    error?: string;
    network?: ObservationNetworkStats;
  };
  timestamp: string;
};

export type SummaryRow = {
  profileId: string;
  scenarioId: string;
  clientId: ClientId;
  metric: string;
  sampleCount: number;
  qualifiedCount: number;
  outOfRangeCount: number;
  outOfRangeRatio: number;
  values: {
    raw: number[];
    qualified: number[];
    outOfRange: number[];
  };
  boundary?: MetricBoundary;
  stats: {
    median: number | null;
    mean: number | null;
    min: number | null;
    max: number | null;
    delta: number | null;
  };
  baseline?: {
    profileId: string;
    medianDelta: number | null;
    meanDelta: number | null;
    minDelta: number | null;
    maxDelta: number | null;
    deltaDelta: number | null;
    gate: 'baseline' | 'pass' | 'fail' | 'n/a';
  };
};

export type LabReport = {
  schema: 'cwv-bench-report/1';
  sessionId: string;
  generatedAt: string;
  cohort: Cohort;
  methodology: Methodology;
  clients: ClientId[];
  observationCount: number;
  summary: SummaryRow[];
};

export type LabDefinition = {
  lab: Lab;
  profiles: Profile[];
  scenarios: Scenario[];
};
