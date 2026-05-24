import type { BrowserContext, Page } from 'playwright';
import type { Profile } from '../../lab/types';
import type { ResolvedNetworkPolicy } from '../network-policy';
import { catalogItemsBody, productDemoBody } from './mock-fixtures';

function blockScriptGlob(pattern: string): string {
  return pattern.startsWith('**') ? pattern : `**/*${pattern.replace(/^\//, '')}`;
}

export async function installBlockScriptsOnPage(
  page: Page,
  patterns: string[],
): Promise<void> {
  for (const pattern of patterns) {
    const glob = blockScriptGlob(pattern);
    await page.route(glob, (route) => route.abort());
  }
}

export async function installApiMocksOnPage(page: Page): Promise<void> {
  await page.route('**/api/items', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: catalogItemsBody,
    });
  });

  await page.route('**/api/product/demo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: productDemoBody,
    });
  });
}

export async function applyNetworkPolicyToPage(
  page: Page,
  policy: ResolvedNetworkPolicy,
): Promise<void> {
  if (policy.mockApi) {
    await installApiMocksOnPage(page);
  }
  if (policy.blockScripts.length) {
    await installBlockScriptsOnPage(page, policy.blockScripts);
  }
}

async function applyNetworkPolicyToContext(
  context: BrowserContext,
  policy: ResolvedNetworkPolicy,
): Promise<void> {
  for (const page of context.pages()) {
    await applyNetworkPolicyToPage(page, policy);
  }
  context.on('page', (page) => {
    void applyNetworkPolicyToPage(page, policy);
  });
}

export type BrowserSessionOptions = {
  cdpUrl: string;
  policy: ResolvedNetworkPolicy;
  profile: Profile;
};

/** Connect over CDP, create a profile-scoped context with network policy applied. */
export async function beginBrowserSession(
  options: BrowserSessionOptions,
): Promise<{ release: () => Promise<void> }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.connectOverCDP(options.cdpUrl);

  for (const stale of browser.contexts()) {
    await stale.close();
  }

  const context = await browser.newContext({
    viewport: {
      width: options.profile.device.width,
      height: options.profile.device.height,
    },
    locale: options.profile.system.locale,
    timezoneId: options.profile.system.timezoneId,
  });
  await applyNetworkPolicyToContext(context, options.policy);
  await context.newPage();

  return {
    release: async () => {
      for (const ctx of browser.contexts()) {
        await ctx.close();
      }
      await browser.close();
    },
  };
}
