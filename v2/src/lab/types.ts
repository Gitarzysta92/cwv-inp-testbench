/** How profile × replicate runs are ordered in one cohort session. */
export type BenchSchedule = 'sequential' | 'interleave';

export type Cohort = {
  hostClass: string;
  appVersion: string;
};

export type Methodology = {
  replicates: number;
  schedule: BenchSchedule;
  metric: string;
  percentiles: number[];
  trimExtremesPercent: number;
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
};

export type ExecutionStep = {
  profileId: string;
  replicate: number;
  stepIndex: number;
};

export type SessionStep = ExecutionStep & {
  clientId: ClientId;
  scenarioId: string;
  sessionStepIndex: number;
};

export type ObservationStatus = 'ok' | 'missing_metric' | 'failed' | 'not_implemented';

export type Observation = {
  schema: 'cwv-bench-observation/1';
  sessionId: string;
  cohort: Cohort;
  profileId: string;
  profileLabel: string;
  scenarioId: string;
  scenarioLabel: string;
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
  };
  timestamp: string;
};

export type SummaryRow = {
  profileId: string;
  scenarioId: string;
  clientId: ClientId;
  metric: string;
  count: number;
  countUsed: number;
  stats: Record<string, number>;
  worst: number | null;
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
