import type { Page } from 'playwright';
import {
  clickByPattern,
  clickHomeProductBox,
  defineEuroScenarioTest,
  gotoEuroHome,
  isEuroBlocked,
  pageOutcomeMeta,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseAddToCart(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);

  const interactionStartedAt = Date.now();
  const productLabel = await clickHomeProductBox(page, 'add-to-cart-product-box', 700);
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_000);

  let addToCartLabel = '';
  let addToCartClicked = false;
  const pdpBlocked = await isEuroBlocked(page);
  if (!pdpBlocked) {
    addToCartLabel = await clickByPattern(
      page,
      /Do koszyka|Dodaj do koszyka|Kup teraz|Koszyk/i,
      'add-to-cart',
      {
        selector: 'button,[role="button"],a',
        preferLeft: true,
        preferTop: true,
      },
    );
    addToCartClicked = true;
    await page.waitForTimeout(1_000);
  }

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: addToCartClicked ? addToCartLabel : productLabel,
    meta: {
      ...(await pageOutcomeMeta(page)),
      productLabel,
      addToCartClicked,
      pdpBlocked,
    },
    metrics: {
      addToCartClicked: addToCartClicked ? 1 : 0,
      pdpBlocked: pdpBlocked ? 1 : 0,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-add-to-cart',
  title: 'euro add to cart',
  exercise: exerciseAddToCart,
});
