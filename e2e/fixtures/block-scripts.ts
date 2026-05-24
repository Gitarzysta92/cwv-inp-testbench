import type { Page } from '@playwright/test';

/** Abort script requests matching profile.browser.blockScripts patterns. */
export async function installBlockScripts(page: Page): Promise<void> {
  const raw = process.env['BENCH_BLOCK_SCRIPTS_JSON'];
  if (!raw) return;

  let patterns: string[];
  try {
    patterns = JSON.parse(raw) as string[];
  } catch {
    return;
  }

  for (const pattern of patterns) {
    const glob = pattern.startsWith('**') ? pattern : `**/*${pattern.replace(/^\//, '')}`;
    await page.route(glob, (route) => route.abort());
  }
}
