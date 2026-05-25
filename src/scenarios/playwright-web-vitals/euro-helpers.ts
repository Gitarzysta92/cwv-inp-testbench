import { expect, test } from '@playwright/test';
import type { Page } from 'playwright';
import {
  assertRuntimeCacheWarmup,
  connectPreparedPage,
  env,
  installWebVitals,
  readBrowserMetrics,
  readWarmupResult,
  toBenchMetrics,
  warmupMetaValues,
  writeInvocation,
  type ScenarioTiming,
} from './shared';

export type ClickTarget = {
  x: number;
  y: number;
  label: string;
};

export type ListingState = {
  productCounter: string;
  productLinkCount: number;
  quickFilterCount: number;
  hasSortControl: boolean;
  scrollY: number;
};

export type EuroScenarioResult = ScenarioTiming & {
  meta?: Record<string, string | number | boolean>;
  metrics?: Record<string, number>;
};

export type EuroScenarioDefinition = {
  id: string;
  title: string;
  exercise: (page: Page, baseUrl: string) => Promise<EuroScenarioResult>;
};

export function pageUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

export async function clearConsentOverlay(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    let removed = false;
    for (const element of document.querySelectorAll('#usercentrics-cmp-ui')) {
      element.remove();
      removed = true;
    }

    const selectors = ['[id*="usercentrics"]', '[class*="usercentrics"]'];
    for (const element of document.querySelectorAll(selectors.join(','))) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        element.remove();
        removed = true;
      }
    }
    return removed;
  }).catch(() => false);
}

export async function assertNotBlocked(page: Page, label: string): Promise<void> {
  const title = await page.title().catch(() => '');
  const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  if (/RTV Euro AGD - Blokada|Twoje żądanie zostało zablokowane/i.test(`${title} ${body}`)) {
    throw new Error(`Euro block page reached during ${label}: ${title}`);
  }
}

export async function isEuroBlocked(page: Page): Promise<boolean> {
  const title = await page.title().catch(() => '');
  const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
  return /RTV Euro AGD - Blokada|Twoje żądanie zostało zablokowane/i.test(`${title} ${body}`);
}

export async function pageOutcomeMeta(page: Page): Promise<Record<string, string | number | boolean>> {
  const title = await page.title().catch(() => '');
  return {
    finalUrl: page.url(),
    finalTitle: title,
    euroBlocked: await isEuroBlocked(page),
  };
}

export async function waitForText(page: Page, pattern: RegExp, timeout = 12_000): Promise<void> {
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(document.body.innerText),
    { source: pattern.source, flags: pattern.flags },
    { timeout },
  );
}

export async function findClickTarget(
  page: Page,
  pattern: RegExp,
  options?: {
    selector?: string;
    preferLeft?: boolean;
    preferTop?: boolean;
  },
): Promise<ClickTarget> {
  const selector =
    options?.selector ??
    'button,a,[role="button"],[role="menuitem"],[role="option"],label,eui-box';
  const target = await page.evaluate(
    ({ flags, preferLeft, preferTop, selector, source }) => {
      const matcher = new RegExp(source, flags);
      const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

      const rows = elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const visibleLabel = Array.from(
            new Set(
              [
                element.innerText,
                element.textContent,
                element.getAttribute('aria-label'),
                element.getAttribute('title'),
                element.getAttribute('href'),
                element.getAttribute('placeholder'),
                element.getAttribute('name'),
                element.getAttribute('id'),
                element.getAttribute('data-automation-id'),
                element.getAttribute('ems-automation-id'),
              ]
                .filter(Boolean)
                .map((value) => String(value).replace(/\s+/g, ' ').trim())
                .filter(Boolean),
            ),
          ).join(' ');
          const label = [visibleLabel, element.getAttribute('class')]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (
            rect.width < 6 ||
            rect.height < 6 ||
            rect.bottom < 0 ||
            rect.top > window.innerHeight ||
            rect.right < 0 ||
            rect.left > window.innerWidth ||
            style.visibility === 'hidden' ||
            style.display === 'none' ||
            Number(style.opacity) === 0 ||
            (!matcher.test(visibleLabel) && !matcher.test(label))
          ) {
            return undefined;
          }

          let score = 0;
          if (preferLeft) score += Math.max(0, 2_000 - rect.left);
          if (preferTop) score += Math.max(0, 2_000 - rect.top);
          if (element.tagName === 'BUTTON') score += 50;
          if (element.tagName === 'A') score += 30;
          if (element.getAttribute('role')) score += 20;

          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            label: label.slice(0, 180),
            score,
          };
        })
        .filter((row): row is ClickTarget & { score: number } => !!row)
        .sort((a, b) => b.score - a.score);

      return rows[0];
    },
    {
      flags: pattern.flags,
      preferLeft: !!options?.preferLeft,
      preferTop: !!options?.preferTop,
      selector,
      source: pattern.source,
    },
  );

  if (!target) {
    throw new Error(`No visible target matched ${pattern}`);
  }

  return target;
}

export async function waitForClickTarget(
  page: Page,
  pattern: RegExp,
  label: string,
  options?: Parameters<typeof findClickTarget>[2],
  timeout = 10_000,
): Promise<ClickTarget> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeout) {
    try {
      return await findClickTarget(page, pattern, options);
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(250);
    }
  }

  throw new Error(
    `Timed out waiting for ${label} matching ${pattern}: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

export async function clickByPattern(
  page: Page,
  pattern: RegExp,
  label: string,
  options?: Parameters<typeof findClickTarget>[2],
): Promise<string> {
  const target = await waitForClickTarget(page, pattern, label, options);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(350);
  await clearConsentOverlay(page);
  return `${label}:${target.label}`;
}

export async function maybeClickByPattern(
  page: Page,
  pattern: RegExp,
  label: string,
  options?: Parameters<typeof findClickTarget>[2],
): Promise<string | undefined> {
  try {
    return await clickByPattern(page, pattern, label, options);
  } catch {
    return undefined;
  }
}

export async function gotoEuroHome(page: Page, baseUrl: string): Promise<void> {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(1_000);
  await clearConsentOverlay(page);
  await assertNotBlocked(page, 'home navigation');
}

export async function gotoEuroHomeSection(
  page: Page,
  baseUrl: string,
  scrollY: number,
): Promise<void> {
  await gotoEuroHome(page, baseUrl);
  await page.evaluate((nextScrollY) => window.scrollTo(0, nextScrollY), scrollY);
  await page.waitForTimeout(1_000);
  await clearConsentOverlay(page);
}

export async function findEuroMenuTrigger(page: Page): Promise<ClickTarget> {
  return findClickTarget(page, /menu|kategorie|wszystkie|produkty|hamburger/i, {
    selector: 'button,a,[role="button"],[aria-haspopup],[aria-controls],[data-testid],[data-test]',
    preferLeft: true,
    preferTop: true,
  });
}

export async function clickHomeProductBox(
  page: Page,
  label: string,
  scrollY = 700,
): Promise<string> {
  const scrollCandidates = Array.from(new Set([scrollY, 700, 1_200, 2_600, 3_600]));
  let lastError: unknown;

  for (const nextScrollY of scrollCandidates) {
    await page.evaluate((value) => window.scrollTo(0, value), nextScrollY);
    await page.waitForTimeout(1_000);
    await clearConsentOverlay(page);
    try {
      return await clickByPattern(
        page,
        /Nawiguj do linku|Smartfon|Hulajnoga|Kawa|Dyson|Nespresso|Air fryer/i,
        label,
        {
          selector:
            'a.product-box__name,a[data-automation-id="product-box-name"],a[ems-automation-id="product-box-name"]',
          preferLeft: true,
          preferTop: true,
        },
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function navigateToSmartphonesListing(
  page: Page,
  baseUrl: string,
): Promise<ListingState> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(pageUrl(baseUrl, '/telefony-komorkowe.bhtml'), {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(2_000);
      await clearConsentOverlay(page);
      await assertNotBlocked(page, 'smartphones listing');
      await waitForText(page, /Smartfony i telefony komórkowe|Sortowanie|Cena|Marka/i);
      return readListingState(page);
    } catch (err) {
      lastError = err;
      if (err instanceof Error && /Euro block page reached/i.test(err.message)) {
        throw err;
      }
      await page.waitForTimeout(1_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function readListingState(page: Page): Promise<ListingState> {
  return page.evaluate(() => {
    const text = (value: string | null | undefined): string =>
      (value ?? '').replace(/\s+/g, ' ').trim();
    const bodyText = text(document.body?.innerText);
    const productCounters = (bodyText.match(/\b\d+\s+produkt(?:ów|y)?\b/gi) ?? [])
      .map((match) => ({
        label: match,
        value: Number(match.match(/\d+/)?.[0] ?? 0),
      }))
      .sort((a, b) => b.value - a.value);
    const productCounter = productCounters[0]?.label ?? '';
    const quickFilterCount = Array.from(document.querySelectorAll('eui-box,button,a')).filter((element) =>
      /iPhone 17|Galaxy S|Telefony składane|Dla seniora/i.test(text(element.textContent)),
    ).length;

    return {
      productCounter,
      productLinkCount: document.querySelectorAll(
        'a[href*="/telefony-komorkowe/"][href*=".bhtml"]',
      ).length,
      quickFilterCount,
      hasSortControl: /Sortowanie|Popularność/i.test(bodyText),
      scrollY: Math.round(window.scrollY),
    };
  });
}

export async function scrollToListingControls(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(750);
  await clearConsentOverlay(page);
}

export async function scrollListingFilterPane(page: Page, scrollTop: number): Promise<void> {
  const didScroll = await page.evaluate((nextScrollTop) => {
    const panes = Array.from(
      document.querySelectorAll<HTMLElement>('.filters-scroll-wrapper'),
    );
    const pane = panes.find(
      (element) =>
        /Filtry/i.test(element.innerText) && element.scrollHeight > element.clientHeight,
    );
    if (!pane) {
      return false;
    }

    pane.scrollTop = nextScrollTop;
    return true;
  }, scrollTop);

  if (!didScroll) {
    await page.mouse.move(180, 420);
    await page.mouse.wheel(0, scrollTop);
  }

  await page.waitForTimeout(750);
  await clearConsentOverlay(page);
}

export function listingMetrics(state: ListingState): Record<string, number> {
  return {
    listingHasSortControl: state.hasSortControl ? 1 : 0,
    listingProductLinks: state.productLinkCount,
    listingQuickFilters: state.quickFilterCount,
    listingScrollY: state.scrollY,
  };
}

export function listingMeta(state: ListingState): Record<string, string | number | boolean> {
  return {
    listingProductCounter: state.productCounter,
    listingProductLinks: state.productLinkCount,
    listingQuickFilters: state.quickFilterCount,
    listingHasSortControl: state.hasSortControl,
    listingScrollY: state.scrollY,
  };
}

export async function visibleFilterInputs(page: Page): Promise<ClickTarget[]> {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
    return inputs
      .map((input) => {
        const rect = input.getBoundingClientRect();
        const style = window.getComputedStyle(input);
        if (
          rect.width < 12 ||
          rect.height < 12 ||
          rect.left > 380 ||
          rect.bottom < 120 ||
          rect.top > window.innerHeight ||
          input.disabled ||
          input.readOnly ||
          style.visibility === 'hidden' ||
          style.display === 'none' ||
          Number(style.opacity) === 0
        ) {
          return undefined;
        }

        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          label: input.placeholder || input.name || input.id || input.type || 'filter-input',
        };
      })
      .filter((row): row is ClickTarget => !!row);
  });
}

export function defineEuroScenarioTest(scenario: EuroScenarioDefinition): void {
  test(scenario.title, async () => {
    const selectedScenarioId = env('BENCH_SCENARIO_ID', scenario.id);
    test.skip(
      selectedScenarioId !== scenario.id,
      `BENCH_SCENARIO_ID=${selectedScenarioId} selects another scenario`,
    );

    const baseUrl = env('PLAYWRIGHT_BASE_URL', 'https://www.euro.com.pl/');
    const attached = await connectPreparedPage();
    const warmup = readWarmupResult();

    try {
      assertRuntimeCacheWarmup(warmup);
      await installWebVitals(attached.page);
      const timing = await scenario.exercise(attached.page, baseUrl);
      const snapshot = await readBrowserMetrics(attached.page);
      const { metrics, inpSource } = toBenchMetrics(snapshot, timing, warmup);

      writeInvocation('passed', {
        scenarioId: scenario.id,
        metrics: {
          ...metrics,
          ...(timing.metrics ?? {}),
        },
        meta: {
          inpSource,
          browserConnectMode: env('BENCH_BROWSER_CONNECT_MODE', 'launch'),
          appBaseUrl: baseUrl,
          interactionLabel: timing.interactionLabel ?? scenario.id,
          ...(timing.meta ?? {}),
          ...warmupMetaValues(warmup),
        },
      });

      expect(metrics['inpMs']).toBeGreaterThanOrEqual(0);
      expect(metrics['wallClockMs']).toBeGreaterThan(0);
    } catch (err) {
      writeInvocation('failed', {
        scenarioId: scenario.id,
        metrics: {},
        meta: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    } finally {
      await attached.cleanup().catch(() => {});
    }
  });
}
