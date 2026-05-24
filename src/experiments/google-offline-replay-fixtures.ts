import type { Profile } from '../lab/types';

export const GOOGLE_APP_URL =
  process.env['GOOGLE_APP_URL'] ?? 'https://www.google.com';

export const GOOGLE_BLOCK_SCRIPT_PATTERNS = [
  '**/gen_204**',
  '*googletagmanager.com*',
  '*google-analytics.com*',
  '*doubleclick.net*',
];

export function googleLiveProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'live-google',
    label: 'Live Google offline replay profile',
    role: 'baseline',
    warmup: 'cold',
    network: {
      kind: 'live',
      baseUrl: GOOGLE_APP_URL,
      blockScripts: GOOGLE_BLOCK_SCRIPT_PATTERNS,
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
      apiMode: 'live',
      payloads: 'live',
      images: 'live',
      serveMode: 'live',
      featureFlags: 'live',
    },
    ...overrides,
  };
}
