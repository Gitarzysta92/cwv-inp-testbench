import type { Profile } from '../../lab/types';

export const LIVE_APP_URL = process.env['APP_BASE_URL'] ?? 'https://www.google.com';

export function liveGoogleProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'live-google',
    label: 'Live Google test profile',
    role: 'baseline',
    warmup: 'cold',
    network: {
      kind: 'live',
      baseUrl: LIVE_APP_URL,
      blockScripts: ['**/gen_204**'],
    },
    device: { width: 1280, height: 720 },
    system: { timezoneId: 'UTC', locale: 'en-US' },
    browser: {
      engine: 'chromium',
      project: 'Desktop Chrome',
      headless: true,
      freshContextPerRun: true,
    },
    application: {
      apiMode: 'mocked',
      payloads: 'fixed-fixtures',
      images: 'live',
      serveMode: 'live',
      featureFlags: 'live',
    },
    ...overrides,
  };
}
