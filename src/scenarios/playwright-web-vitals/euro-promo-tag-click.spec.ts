import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  gotoEuroHome,
  type EuroScenarioResult,
} from './euro-helpers';

async function exercisePromoTagClick(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);

  const interactionStartedAt = Date.now();
  const label = await clickByPattern(
    page,
    /Majówka Rabatówka|60 zł za każde wydane|Zyskaj kod|Pakiet usług/i,
    'promo-tag',
    {
      selector: 'button[role="tab"],.rotator-nav__item',
      preferLeft: true,
      preferTop: true,
    },
  );
  await page.waitForTimeout(1_000);
  const activeTag = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rotator-nav__item--active'))
      .map((element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' | '),
  );

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: label,
    meta: {
      activePromoTag: activeTag,
    },
    metrics: {
      promoTagActivated: activeTag ? 1 : 0,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-promo-tag-click',
  title: 'euro promo tag click',
  exercise: exercisePromoTagClick,
});
