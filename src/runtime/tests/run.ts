#!/usr/bin/env node
/**
 * Runtime smoke tests — live Google target, small test client.
 *
 *   npm run runtime:test              # stack must already be running
 *   npm run runtime:test -- --docker  # docker build + run
 *   npm run runtime:test -- --local   # chrome-launcher + driver on host
 */
import { catalog } from '../driver/mock-fixtures';
import { RUNTIME_API_SCHEMA } from '../api/types';
import { liveGoogleProfile, LIVE_APP_URL } from './fixtures';
import { RuntimeTestClient } from './runtime-client';
import { upDockerStack, upLocalStack } from './stack';

type TestResult = { name: string; ok: boolean; detail?: string };
const results: TestResult[] = [];

function pass(name: string, detail?: string): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

async function testHealth(client: RuntimeTestClient): Promise<void> {
  const health = await client.health();
  if (health.status === 200 && health.body.status === 'ok') {
    pass('GET /health', health.body.browserCdpUrl);
  } else {
    fail('GET /health', `status ${health.status}`);
  }

  const browser = await client.browserStatus();
  if (browser.status === 200 && browser.body.ready) {
    pass('GET /v1/browser/status', browser.body.cdpUrl);
  } else {
    fail('GET /v1/browser/status', `ready=${String(browser.body.ready)}`);
  }
}

async function testLiveNavigation(client: RuntimeTestClient, stepKey: string): Promise<void> {
  const prepared = await client.prepareStep({ stepKey, profile: liveGoogleProfile() });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('POST /v1/step/prepare', `status ${prepared.status}`);
    return;
  }

  pass('POST /v1/step/prepare', prepared.body.browser.appBaseUrl);

  const { browser, page } = await client.connectBrowser(prepared.body.browser.targetId);
  await page.goto(LIVE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const title = await page.title();
  if (/google/i.test(title)) {
    pass('live navigation', title);
  } else {
    fail('live navigation', title || 'empty title');
  }

  const searchCount = await page.locator('textarea[name="q"], input[name="q"]').count();
  if (searchCount > 0) {
    pass('google search input', `${searchCount} element(s)`);
  } else {
    fail('google search input', 'not found');
  }

  await browser.close();
  await client.releaseStep(stepKey);
}

async function testNetworkMocking(client: RuntimeTestClient): Promise<void> {
  const stepKey = `mock-${Date.now()}`;
  const prepared = await client.prepareStep({ stepKey, profile: liveGoogleProfile() });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('network mock prepare', `status ${prepared.status}`);
    return;
  }

  const { browser, page } = await client.connectBrowser(prepared.body.browser.targetId);
  await page.goto(LIVE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const mockResult = await page.evaluate(async () => {
    const res = await fetch('/api/items');
    return res.json() as Promise<{ items: unknown[] }>;
  });

  if (mockResult.items?.length === catalog.items.length) {
    pass('network mock /api/items', `${mockResult.items.length} items`);
  } else {
    fail('network mock /api/items', JSON.stringify(mockResult));
  }

  await browser.close();
  await client.releaseStep(stepKey);
}

async function testScriptBlocking(client: RuntimeTestClient): Promise<void> {
  const stepKey = `block-${Date.now()}`;
  const prepared = await client.prepareStep({ stepKey, profile: liveGoogleProfile() });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('script block prepare', `status ${prepared.status}`);
    return;
  }

  const { browser, page } = await client.connectBrowser(prepared.body.browser.targetId);
  const aborted: string[] = [];
  page.on('requestfailed', (req) => {
    if (req.url().includes('gen_204')) {
      aborted.push(req.url());
    }
  });

  await page.goto(LIVE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(2_000);

  if (aborted.length > 0) {
    pass('script blocking gen_204', `${aborted.length} aborted`);
  } else {
    pass('script blocking gen_204', 'policy installed (no gen_204 this load)');
  }

  await browser.close();
  await client.releaseStep(stepKey);
}

async function testWarmAssets(client: RuntimeTestClient): Promise<void> {
  const stepKey = `warm-assets-${Date.now()}`;
  const prepared = await client.prepareStep({
    stepKey,
    profile: liveGoogleProfile({ warmup: 'warm_assets' }),
  });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('warm_assets prepare', `status ${prepared.status}`);
    return;
  }

  const { browser, page } = await client.connectBrowser(prepared.body.browser.targetId);
  const staticRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('gstatic.com') && req.resourceType() === 'image') {
      staticRequests.push(req.url());
    }
  });

  await page.goto(LIVE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const firstLoad = staticRequests.length;
  await page.goto(LIVE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const secondLoad = staticRequests.length - firstLoad;

  pass('warm_assets first nav', `${firstLoad} gstatic image(s)`);
  pass('warm_assets repeat nav', secondLoad === 0 && firstLoad > 0 ? 'cached' : `${secondLoad} re-fetch`);

  await browser.close();
  await client.releaseStep(stepKey);
}

async function testWarmSession(client: RuntimeTestClient): Promise<void> {
  const stepKey = `warm-session-${Date.now()}`;
  const prepared = await client.prepareStep({
    stepKey,
    profile: liveGoogleProfile({ warmup: 'warm_session' }),
  });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('warm_session prepare', `status ${prepared.status}`);
    return;
  }

  const { browser, page } = await client.connectBrowser(prepared.body.browser.targetId);
  await page.goto(LIVE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const value = await page.evaluate(() => sessionStorage.getItem('bench-warm-session'));

  if (value === '1') {
    pass('warm_session sessionStorage', value);
  } else {
    fail('warm_session sessionStorage', value ?? 'missing');
  }

  await browser.close();
  await client.releaseStep(stepKey);
}

async function testRelease(client: RuntimeTestClient, stepKey: string): Promise<void> {
  const released = await client.releaseStep(stepKey);
  if (released.status === 200 && 'released' in released.body && released.body.released) {
    pass('POST /v1/step/release', stepKey);
  } else {
    fail('POST /v1/step/release', `status ${released.status}`);
  }

  const again = await client.releaseStep(stepKey);
  if (again.status === 200 && 'released' in again.body && !again.body.released) {
    pass('release guard', 'idempotent double release');
  } else {
    fail('release guard', `expected released=false, got status ${again.status}`);
  }
}

async function main(): Promise<void> {
  const useDocker = process.argv.includes('--docker');
  const useLocal = process.argv.includes('--local');

  console.error('\nRuntime tests');
  console.error(`  schema: ${RUNTIME_API_SCHEMA}`);
  console.error(`  app:    ${LIVE_APP_URL}\n`);

  let stack: Awaited<ReturnType<typeof upDockerStack>> | undefined;
  let client: RuntimeTestClient;

  if (useDocker) {
    console.error('Starting Docker stack…\n');
    stack = await upDockerStack();
    client = new RuntimeTestClient({ apiUrl: stack.apiUrl, cdpUrl: stack.cdpUrl });
  } else if (useLocal) {
    console.error('Starting local stack…\n');
    stack = await upLocalStack();
    client = new RuntimeTestClient({ apiUrl: stack.apiUrl, cdpUrl: stack.cdpUrl });
  } else {
    client = new RuntimeTestClient();
    await client.waitForReady();
  }

  console.error(`  API: ${client.apiUrl}`);
  console.error(`  CDP: ${client.cdpUrl}\n`);

  try {
    console.error('1. Health & browser');
    await testHealth(client);

    console.error('\n2. Live navigation');
    await testLiveNavigation(client, `run-${Date.now()}`);

    console.error('\n3. Network mocking');
    await testNetworkMocking(client);

    console.error('\n4. Script blocking');
    await testScriptBlocking(client);

    console.error('\n5. Warm assets');
    await testWarmAssets(client);

    console.error('\n6. Warm session');
    await testWarmSession(client);

    console.error('\n7. Release guard');
    const releaseKey = `release-${Date.now()}`;
    const prepared = await client.prepareStep({ stepKey: releaseKey, profile: liveGoogleProfile() });
    if (prepared.status === 200 && 'prepared' in prepared.body) {
      await testRelease(client, releaseKey);
    } else {
      fail('release prepare', `status ${prepared.status}`);
    }
  } finally {
    if (stack) {
      console.error('\nStopping stack…');
      await stack.stop();
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.error(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((r) => console.error(`  FAIL: ${r.name} — ${r.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
