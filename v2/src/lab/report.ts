import * as path from 'path';

/** Fixed report contract — not part of lab config. */
export const REPORT_SCHEMA = 'cwv-bench-report/1' as const;
export const OBSERVATION_SCHEMA = 'cwv-bench-observation/1' as const;

export const OBSERVATION_METRICS = [
  'inpMs',
  'eventTimingMaxMs',
  'wallClockMs',
  'searchTypingWallMs',
] as const;

export type ObservationMetric = (typeof OBSERVATION_METRICS)[number];

export const REPORT_STORAGE = {
  rootDir: 'bench-results/v2',
  observationsSubdir: 'observations',
  summarySubdir: 'summary',
} as const;

export type ReportStoragePaths = {
  rootDir: string;
  observationsDir: string;
  summaryDir: string;
};

export function reportStoragePaths(repoRoot: string, sessionId: string): ReportStoragePaths {
  const rootDir = path.isAbsolute(REPORT_STORAGE.rootDir)
    ? REPORT_STORAGE.rootDir
    : path.join(repoRoot, REPORT_STORAGE.rootDir);
  return {
    rootDir,
    observationsDir: path.join(rootDir, REPORT_STORAGE.observationsSubdir, sessionId),
    summaryDir: path.join(rootDir, REPORT_STORAGE.summarySubdir, sessionId),
  };
}
