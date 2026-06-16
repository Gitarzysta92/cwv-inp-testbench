import type { Page } from 'playwright';
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

  const candidate = await findEuroMenuTrigger(page);
  await page.mouse.move(candidate.x, candidate.y);
  await page.waitForTimeout(250);

  const interactionStartedAt = Date.now();
  await page.mouse.down();
  await page.mouse.up();

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

  return {
    scenarioDurationMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `euro-open-menu:${candidate.label}`,
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-open-menu',
  title: 'euro open menu',
  exercise: exerciseEuroOpenMenu,
});
