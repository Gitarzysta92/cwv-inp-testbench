import type { Page } from 'playwright';
import {
  clearConsentOverlay,
  clickByPattern,
  defineEuroScenarioTest,
  isEuroBlocked,
  pageOutcomeMeta,
  pageUrl,
  readListingState,
  waitForText,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseListingOpenFilters(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await page.goto(pageUrl(baseUrl, '/search.bhtml?keyword=iphone'), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await clearConsentOverlay(page);
  if (await isEuroBlocked(page)) {
    return {
      wallClockMs: Date.now() - startedAt,
      interactionWallMs: 0,
      interactionLabel: 'open-filters:block-page',
      meta: {
        ...(await pageOutcomeMeta(page)),
        filtersOpened: false,
      },
      metrics: {
        listingFiltersOpened: 0,
      },
    };
  }
  await waitForText(page, /Wyniki wyszukiwania|Filtry|Cena|Marka/i);

  const interactionStartedAt = Date.now();
  const label = await clickByPattern(page, /^Cena(?:\s+Cena)?$|^Marka(?:\s+Marka)?$/i, 'open-filters', {
    selector: 'button,eui-box',
    preferLeft: true,
    preferTop: true,
  });
  await page.waitForTimeout(1_000);
  const state = await readListingState(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: label,
    meta: {
      listingProductCounter: state.productCounter,
      listingProductLinks: state.productLinkCount,
      listingQuickFilters: state.quickFilterCount,
      listingHasSortControl: state.hasSortControl,
      listingScrollY: state.scrollY,
      filtersOpened: true,
    },
    metrics: {
      listingHasSortControl: state.hasSortControl ? 1 : 0,
      listingProductLinks: state.productLinkCount,
      listingQuickFilters: state.quickFilterCount,
      listingScrollY: state.scrollY,
      listingFiltersOpened: 1,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-listing-open-filters',
  title: 'euro listing open filters',
  exercise: exerciseListingOpenFilters,
});
