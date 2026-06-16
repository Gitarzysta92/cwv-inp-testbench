import type { Page } from 'playwright';
import {
  captureBrowserSystemInfo,
  captureRafCadence,
  captureScriptBodies,
  startChromeTrace,
  startCpuProfile,
  writeDebugScreenshot,
} from './shared';
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
  const browserSystemPath = await captureBrowserSystemInfo(page, '00-browser-system');
  const rafCadenceBeforePath = await captureRafCadence(page, '00-raf-cadence-before-click');
  const scriptBodiesPath = await captureScriptBodies(page, '00-script-bodies');
  await writeDebugScreenshot(page, '01-home-ready');

  const candidate = await findEuroMenuTrigger(page);
  await page.mouse.move(candidate.x, candidate.y);
  await page.waitForTimeout(250);
  await writeDebugScreenshot(page, '02-menu-hover-target');

  const trace = await startChromeTrace(page, '06-menu-interaction-trace');
  const cpuProfile = await startCpuProfile(page, '07-menu-interaction-cpu-profile');
  let tracePath: string | undefined;
  let cpuProfilePath: string | undefined;
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
    cpuProfilePath = await cpuProfile.stop();
    tracePath = await trace.stop();
  }
  await writeDebugScreenshot(page, '04-menu-after-wait');
  const rafCadenceAfterPath = await captureRafCadence(page, '08-raf-cadence-after-click');

  return {
    scenarioDurationMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `euro-open-menu:${candidate.label}`,
    meta: {
      browserSystemPath: browserSystemPath ?? '',
      rafCadenceBeforePath: rafCadenceBeforePath ?? '',
      rafCadenceAfterPath: rafCadenceAfterPath ?? '',
      capturedScriptBodiesPath: scriptBodiesPath ?? '',
      chromeTracePath: tracePath ?? '',
      cpuProfilePath: cpuProfilePath ?? '',
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-open-menu',
  title: 'euro open menu',
  exercise: exerciseEuroOpenMenu,
});
