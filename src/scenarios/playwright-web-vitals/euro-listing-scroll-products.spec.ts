import type { Page } from 'playwright';
import {
  defineEuroScenarioTest,
  listingMeta,
  listingMetrics,
  navigateToSmartphonesListing,
  readListingState,
  waitForText,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseListingScrollProducts(
  page: Page,
  baseUrl: string,
): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await navigateToSmartphonesListing(page, baseUrl);

  const interactionStartedAt = Date.now();
  for (let index = 0; index < 8; index += 1) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(120);
  }

  await waitForText(page, /Samsung|Apple|iPhone|Galaxy|Porady Ekspertów|Sortowanie/i, 5_000).catch(() => {});
  const state = await readListingState(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: 'listing-scroll-products',
    meta: listingMeta(state),
    metrics: listingMetrics(state),
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-listing-scroll-products',
  title: 'euro listing scroll products',
  exercise: exerciseListingScrollProducts,
});
