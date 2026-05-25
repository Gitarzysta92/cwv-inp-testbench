import { defineConfig, devices } from '@playwright/test';

const chromiumLabArgs = [
  '--disable-background-networking',
  '--disable-component-extensions-with-background-pages',
  '--disable-extensions',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
];

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:4200';
const skipWebServer = !!process.env['PLAYWRIGHT_SKIP_WEBSERVER'];
const orchestrated = process.env['BENCH_ORCHESTRATED'] === '1';

const viewportWidth = Number(process.env['BENCH_VIEWPORT_WIDTH'] ?? '1280');
const viewportHeight = Number(process.env['BENCH_VIEWPORT_HEIGHT'] ?? '720');
const locale = process.env['BENCH_LOCALE'] ?? 'en-US';
const timezoneId = process.env['BENCH_TIMEZONE_ID'] ?? 'UTC';
const headed = process.env['BENCH_HEADED'] === '1';

/**
 * Container-oriented defaults: one worker, stable viewport/locale/timezone, Chromium-only POC.
 * Bench orchestrator sets BENCH_VIEWPORT_*, BENCH_HEADED, BENCH_ORCHESTRATED.
 *
 * Browser appliance (code ↔ browser split): set BROWSER_CDP_URL; specs use
 * e2e/fixtures/bench-test.ts connectOverCDP instead of launching Chromium locally.
 */
export default defineConfig({
  testDir: '../../scenarios/playwright-web-vitals',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: orchestrated
    ? [['list']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: viewportWidth, height: viewportHeight },
    locale,
    timezoneId,
    deviceScaleFactor: 1,
    headless: !headed,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: {
      args: chromiumLabArgs,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: viewportWidth, height: viewportHeight },
        headless: !headed,
      },
    },
  ],
  webServer: skipWebServer
    ? undefined
    : {
        command: 'npm run start -- --host 127.0.0.1 --port 4200',
        url: baseURL,
        reuseExistingServer: !process.env['CI'],
        stdout: 'pipe',
        stderr: 'pipe',
      },
});
