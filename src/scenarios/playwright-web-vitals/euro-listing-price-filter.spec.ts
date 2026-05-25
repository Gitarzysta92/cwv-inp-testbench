import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  listingMeta,
  listingMetrics,
  navigateToSmartphonesListing,
  readListingState,
  visibleFilterInputs,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseListingPriceFilter(
  page: Page,
  baseUrl: string,
): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await navigateToSmartphonesListing(page, baseUrl);

  const interactionStartedAt = Date.now();
  const priceSection = await clickByPattern(page, /^Cena(?:\s+Cena)?$/i, 'listing-price-section', {
    selector: 'button,eui-box',
    preferLeft: true,
    preferTop: true,
  });
  await page.waitForTimeout(500);

  const inputs = await visibleFilterInputs(page);
  if (inputs.length < 1) {
    throw new Error('Euro listing price filter inputs were not visible');
  }

  const values = ['1000', '5000'];
  for (const [index, value] of values.entries()) {
    const input = inputs[index];
    if (!input) {
      break;
    }
    await page.mouse.click(input.x, input.y);
    await page.keyboard.type(value, { delay: 35 });
  }
  await page.keyboard.press('Enter').catch(() => {});

  await page.waitForTimeout(1_200);
  const state = await readListingState(page);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `${priceSection}:filled-${Math.min(inputs.length, values.length)}`,
    meta: {
      ...listingMeta(state),
      priceInputsFilled: Math.min(inputs.length, values.length),
    },
    metrics: {
      ...listingMetrics(state),
      listingPriceInputsFilled: Math.min(inputs.length, values.length),
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-listing-price-filter',
  title: 'euro listing price filter',
  exercise: exerciseListingPriceFilter,
});
