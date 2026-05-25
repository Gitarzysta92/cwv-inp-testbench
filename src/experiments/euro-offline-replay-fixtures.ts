import type { Profile } from '../lab/types';

export const EURO_APP_URL = process.env['EURO_APP_URL'] ?? 'https://www.euro.com.pl/';

export const EURO_BLOCK_SCRIPT_PATTERNS = [
  '*googletagmanager.com*',
  '*google-analytics.com*',
  '*doubleclick.net*',
  '*facebook.net*',
  '*hotjar.com*',
  '*clarity.ms*',
  '*criteo.com*',
  '*gemius.pl*',
  '*salesmanago*',
  '*synerise*',
  '*edrone*',
  '*onetrust*',
  '*cookielaw.org*',
];

export function euroLiveProfile(overrides?: Partial<Profile>): Profile {
  return {
    id: 'live-euro',
    label: 'Live euro.com.pl test profile',
    role: 'baseline',
    warmup: 'cold',
    network: {
      kind: 'live',
      baseUrl: EURO_APP_URL,
      blockScripts: EURO_BLOCK_SCRIPT_PATTERNS,
    },
    device: { width: 1366, height: 768 },
    system: { timezoneId: 'Europe/Warsaw', locale: 'pl-PL' },
    browser: {
      engine: 'chromium',
      project: 'Desktop Chrome',
      headless: false,
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
