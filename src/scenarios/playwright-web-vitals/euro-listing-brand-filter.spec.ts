import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  listingMeta,
  listingMetrics,
  navigateToSmartphonesListing,
  readListingState,
  scrollListingFilterPane,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseListingBrandFilter(
  page: Page,
  baseUrl: string,
): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await navigateToSmartphonesListing(page, baseUrl);
  await scrollListingFilterPane(page, 360);

  const interactionStartedAt = Date.now();
  const brandOption = await clickByPattern(page, /^(Samsung|Apple)\s+\(\d+\)/i, 'listing-brand-option', {
    selector:
      'label,[role="checkbox"],div.check-group__wrapper,div.check-block,div.predefined-values-filters__checkbox',
    preferLeft: true,
    preferTop: true,
  });

  await page.waitForTimeout(1_200);
  const state = await readListingState(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: brandOption,
    meta: {
      ...listingMeta(state),
      brandFilterClicked: true,
    },
    metrics: {
      ...listingMetrics(state),
      listingBrandFilterClicked: 1,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-listing-brand-filter',
  title: 'euro listing brand filter',
  exercise: exerciseListingBrandFilter,
});
