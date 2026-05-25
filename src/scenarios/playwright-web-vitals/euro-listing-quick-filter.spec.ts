import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  listingMeta,
  listingMetrics,
  navigateToSmartphonesListing,
  readListingState,
  scrollToListingControls,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseListingQuickFilter(
  page: Page,
  baseUrl: string,
): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await navigateToSmartphonesListing(page, baseUrl);
  await scrollToListingControls(page);

  const interactionStartedAt = Date.now();
  const label = await clickByPattern(page, /^iPhone 17$|^Galaxy S$/i, 'listing-quick-filter', {
    selector: 'eui-box,button,a,[role="button"]',
    preferTop: true,
  });
  await page.waitForTimeout(1_200);
  const state = await readListingState(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: label,
    meta: {
      ...listingMeta(state),
      quickFilterClicked: true,
    },
    metrics: {
      ...listingMetrics(state),
      listingQuickFilterClicked: 1,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-listing-quick-filter',
  title: 'euro listing quick filter',
  exercise: exerciseListingQuickFilter,
});
