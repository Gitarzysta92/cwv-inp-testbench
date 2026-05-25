import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  listingMeta,
  listingMetrics,
  maybeClickByPattern,
  navigateToSmartphonesListing,
  readListingState,
  scrollToListingControls,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseListingSort(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await navigateToSmartphonesListing(page, baseUrl);
  await scrollToListingControls(page);

  const interactionStartedAt = Date.now();
  const dropdownLabel = await clickByPattern(
    page,
    /Sortowanie|Popularność/i,
    'listing-sort-open',
    {
      selector:
        'ems-ui-sorting-dropdown .wrapper,ems-ui-sorting-dropdown eui-primitive-textfield,ems-ui-sorting-dropdown',
      preferLeft: true,
      preferTop: true,
    },
  );
  const optionLabel = await maybeClickByPattern(
    page,
    /Od najtańszego|Od najdroższego|Najlepiej oceniane|Liczba opinii|Oglądalność/i,
    'listing-sort-option',
    {
      selector: 'eui-option,[role="option"],button,li',
      preferTop: true,
    },
  );

  if (!optionLabel) {
    throw new Error('Euro listing sort option did not open');
  }

  await page.waitForTimeout(1_000);
  const state = await readListingState(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `${dropdownLabel}|${optionLabel}`,
    meta: {
      ...listingMeta(state),
      sortOptionClicked: true,
    },
    metrics: {
      ...listingMetrics(state),
      listingSortOptionClicked: 1,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-listing-sort',
  title: 'euro listing sort',
  exercise: exerciseListingSort,
});
