import type { Page } from 'playwright';
import {
  clickByPattern,
  defineEuroScenarioTest,
  gotoEuroHomeSection,
  type EuroScenarioResult,
} from './euro-helpers';

async function exerciseProductStandardInstallmentsTab(
  page: Page,
  baseUrl: string,
): Promise<EuroScenarioResult> {
  const startedAt = Date.now();
  await gotoEuroHomeSection(page, baseUrl, 700);

  const interactionStartedAt = Date.now();
  const label = await clickByPattern(
    page,
    /RATY\s+\d|rat\s+0%|product-box-price__installment/i,
    'product-standard-installments-tab',
    {
      selector: '.product-box-price__installment,div,eui-box',
      preferLeft: true,
      preferTop: true,
    },
  );
  await page.waitForTimeout(800);

  return {
    wallClockMs: Date.now() - startedAt,
    interactionWallMs: Date.now() - interactionStartedAt,
    interactionLabel: label,
    meta: {
      standardInstallmentsTargetVisible: true,
    },
    metrics: {
      standardInstallmentsTargetClicked: 1,
    },
  };
}

defineEuroScenarioTest({
  id: 'scenario-euro-product-standard-installments-tab',
  title: 'euro product standard installments tab',
  exercise: exerciseProductStandardInstallmentsTab,
});
