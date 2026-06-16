import type { LabDefinition } from '../../../lab/types';
import { GOOGLE_APP_URL, googleLiveProfile } from './profiles';

export const GOOGLE_WEB_VITALS_SCENARIO_ID = 'scenario-google-web-vitals-probe';
export const GOOGLE_WEB_VITALS_PROFILE_ID = 'live-google-web-vitals';
export const GOOGLE_WEB_VITALS_SPEC_PATH =
  'src/scenarios/playwright-web-vitals/google-web-vitals-probe.spec.ts';

export function googleWebVitalsProbeLab(replicates: number): LabDefinition {
  return {
    lab: {
      cohort: {
        hostClass: process.env['BENCH_HOST_CLASS'] ?? 'runtime-docker',
        appVersion: process.env['GIT_SHA'] ?? 'dev',
      },
      methodology: {
        replicates,
        schedule: 'sequential',
        metric: 'inpMs',
        metricBoundaries: {
          inpMs: { min: 10, max: 300 },
          eventTimingMaxMs: { min: 10, max: 300 },
        },
        gate: {
          baselineProfileId: GOOGLE_WEB_VITALS_PROFILE_ID,
          acceptableDeltaMs: 40,
        },
      },
      client: 'playwright-web-vitals',
    },
    profiles: [
      googleLiveProfile({
        id: GOOGLE_WEB_VITALS_PROFILE_ID,
        label: 'Live Google with playwright-web-vitals',
      }),
    ],
    scenarios: [
      {
        id: GOOGLE_WEB_VITALS_SCENARIO_ID,
        label: 'Google web-vitals probe interaction',
        description: [
          'Open Google homepage',
          'Inject and click a deterministic INP probe',
          'Measure INP through web-vitals/onINP',
        ],
      },
    ],
  };
}

export { GOOGLE_APP_URL };
