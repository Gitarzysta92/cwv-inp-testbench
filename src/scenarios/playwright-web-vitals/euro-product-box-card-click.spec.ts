import type { Page } from 'playwright';
import {
  clickHomeProductBox,
  defineEuroScenarioTest,
  gotoEuroHome,
  isEuroBlocked,
  pageOutcomeMeta,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseProductBoxCardClick(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);

  const interactionStartedAt = Date.now();
  const label = await clickHomeProductBox(page, 'home-product-box-card-click', 2_600);
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_000);
  const pdpBlocked = await isEuroBlocked(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: label,
    meta: {
      ...(await pageOutcomeMeta(page)),
      pdpBlocked,
    },
    metrics: {
      productBoxCardClicked: 1,
      pdpBlocked: pdpBlocked ? 1 : 0,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-product-box-card-click',
  title: 'euro product box card click',
  exercise: exerciseProductBoxCardClick,
});
