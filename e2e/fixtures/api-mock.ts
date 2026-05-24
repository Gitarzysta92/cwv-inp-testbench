import type { Page } from '@playwright/test';

/** Must match e2e/fixtures/catalog.json (dev proxy reads file). */
export const catalog = {
  items: [
    { id: '1', name: 'Earbuds', category: 'electronics' as const, price: 49 },
    { id: '2', name: 'Kettle', category: 'home' as const, price: 35 },
    { id: '3', name: 'Lamp', category: 'home' as const, price: 22 },
    { id: '4', name: 'Router', category: 'electronics' as const, price: 79 },
  ],
};

/** Must match e2e/fixtures/product-demo.json (single-line JSON equivalent). */
const productDemoBody = JSON.stringify({
  title: 'Lab Product',
  thumbnails: [
    'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23111%22%2F%3E%3C%2Fsvg%3E',
    'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23222%22%2F%3E%3C%2Fsvg%3E',
    'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23333%22%2F%3E%3C%2Fsvg%3E',
    'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20fill%3D%22%23444%22%2F%3E%3C%2Fsvg%3E',
  ],
});

/**
 * Deterministic API responses for lab runs (static `ng serve` / Docker has no real /api).
 */
export async function installBenchMocks(page: Page): Promise<void> {
  const itemsBody = JSON.stringify(catalog);

  await page.route('**/api/items', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: itemsBody,
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

/** @deprecated use installBenchMocks */
export async function installCatalogMock(page: Page): Promise<void> {
  await installBenchMocks(page);
}
