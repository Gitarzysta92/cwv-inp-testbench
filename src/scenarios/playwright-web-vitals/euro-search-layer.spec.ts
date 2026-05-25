import type { Page } from 'playwright';
import {
  clearConsentOverlay,
  defineEuroScenarioTest,
  findClickTarget,
  gotoEuroHome,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseSearchLayer(page: Page, baseUrl: string): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHome(page, baseUrl);

  const target = await findClickTarget(page, /Szukaj w RTV Euro AGD|Szukaj/i, {
    selector: 'input[placeholder*="Szukaj"],input.search-input__input',
    preferTop: true,
  });
  const interactionStartedAt = Date.now();
  await page.mouse.click(target.x, target.y);
  await page.keyboard.type('iphone', { delay: 30 });
  await page.waitForTimeout(1_000);
  await clearConsentOverlay(page);

  const searchState = await page.evaluate(() => ({
    dropdownVisible:
      document.querySelectorAll('.search-dropdown,.search-dropdown__inner').length > 0,
    clearButtonVisible:
      document.querySelectorAll('.search-input__clear-button').length > 0,
    activeElementTag: document.activeElement?.tagName ?? '',
  }));

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: `search-layer:${target.label}`,
    meta: {
      searchDropdownVisible: searchState.dropdownVisible,
      searchClearButtonVisible: searchState.clearButtonVisible,
      searchActiveElementTag: searchState.activeElementTag,
    },
    metrics: {
      searchDropdownVisible: searchState.dropdownVisible ? 1 : 0,
      searchClearButtonVisible: searchState.clearButtonVisible ? 1 : 0,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-search-layer',
  title: 'euro search layer',
  exercise: exerciseSearchLayer,
});
