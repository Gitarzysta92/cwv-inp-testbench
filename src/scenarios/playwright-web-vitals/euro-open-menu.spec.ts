import type { Page } from 'playwright';
import { startChromeTrace, writeDebugScreenshot } from './shared';
import {
  defineEuroScenarioTest,
  findEuroMenuTrigger,
  gotoEuroHome,
  waitForPageAge,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseEuroOpenMenu(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);
  await waitForPageAge(page, 2_000);
  await writeDebugScreenshot(page, '01-home-ready');

  const candidate = await findEuroMenuTrigger(page);
  await page.mouse.move(candidate.x, candidate.y);
  await page.waitForTimeout(250);
  await writeDebugScreenshot(page, '02-menu-hover-target');

  const trace = await startChromeTrace(page, '06-menu-interaction-trace');
  let tracePath: string | undefined;
  const interactionStartedAt = Date.now();
  try {
    await page.mouse.down();
    await page.mouse.up();
    await writeDebugScreenshot(page, '03-menu-click-sent');

    await page.waitForFunction(
      () =>
        /Laptopy|Telewizory|Smartfony|AGD|Komputery|Kategorie/i.test(document.body.innerText) ||
        typeof (window as Window & {
          __benchWebVitals?: { latest?: Record<string, { value: number }> };
        }).__benchWebVitals?.latest?.['INP']?.value === 'number',
      undefined,
      { timeout: 7_500 },
    ).catch(() => {});
    await page.waitForTimeout(750);
  } finally {
    tracePath = await trace.stop();
  }
  await writeDebugScreenshot(page, '04-menu-after-wait');

  return {
    scenarioDurationMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `euro-open-menu:${candidate.label}`,
    meta: {
      chromeTracePath: tracePath ?? '',
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-open-menu',
  title: 'euro open menu',
  exercise: exerciseEuroOpenMenu,
});
