import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  gotoEuroHome,
  pageOutcomeMeta,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseRotatorBannerClick(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);

  const interactionStartedAt = Date.now();
  const label = await clickByPattern(page, /cms\/|promocj|rabat|rat|produkt/i, 'rotator-banner', {
    selector: '.rotator a,a[href*="/cms/piaty-za-1-zl.bhtml"],a[href*="/cms/zyskaj-kod"]',
    preferLeft: true,
    preferTop: true,
  });
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_000);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: label,
    meta: await pageOutcomeMeta(page),
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-rotator-banner-click',
  title: 'euro rotator banner click',
  exercise: exerciseRotatorBannerClick,
});
