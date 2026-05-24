import { test as base, chromium } from '@playwright/test';

const cdpUrl = process.env.BROWSER_CDP_URL?.trim();
const runtimePrepared = process.env.BENCH_RUNTIME_PREPARED === '1';

/**
 * When BROWSER_CDP_URL is set (code container → browser appliance), attach over CDP
 * instead of launching Chromium in-process. Disconnect on teardown; browser process stays up.
 *
 * When BENCH_RUNTIME_PREPARED=1, reuse the context the runtime driver created (routes/mocks
 * already installed). Otherwise Playwright uses its default context fixture.
 */
export const test = cdpUrl
  ? base.extend({
      browser: [
        async ({}, use) => {
          const browser = await chromium.connectOverCDP(cdpUrl);
          await use(browser);
          await browser.close();
        },
        { scope: 'worker' },
      ],
      ...(runtimePrepared
        ? {
            context: async ({ browser }, use) => {
              const context = browser.contexts()[0];
              if (!context) {
                throw new Error('Runtime driver context missing on CDP browser');
              }
              await use(context);
            },
            page: async ({ context }, use) => {
              const page = context.pages()[0] ?? (await context.newPage());
              await use(page);
            },
          }
        : {}),
    })
  : base;

export { expect } from '@playwright/test';
