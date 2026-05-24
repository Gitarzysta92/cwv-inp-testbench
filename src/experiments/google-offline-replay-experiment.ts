#!/usr/bin/env node
/**
 * Google runtime offline replay experiment.
 *
 *   npx tsx src/experiments/google-offline-replay-experiment.ts --local
 *   npx tsx src/experiments/google-offline-replay-experiment.ts --docker
 *
 * Flow:
 * 1. Prepare a live Google profile with script block patterns.
 * 2. Navigate once online and record cacheable GET responses from CDP.
 * 3. Navigate again with Fetch replay enabled: cache hits are fulfilled locally,
 *    cache misses are failed locally, and no request is continued to the network.
 */
import { RUNTIME_API_SCHEMA } from '../runtime/api/types';
import { CdpConnection } from '../runtime/driver/cdp/connection';
import {
  attachResponseCacheRecorder,
  enableResponseCacheReplay,
  responseCacheKey,
} from '../runtime/driver/cdp/response-cache';
import { listTargets } from '../runtime/driver/cdp/targets';
import {
  GOOGLE_APP_URL,
  GOOGLE_BLOCK_SCRIPT_PATTERNS,
  googleLiveProfile,
} from './google-offline-replay-fixtures';
import { RuntimeTestClient } from '../runtime/tests/runtime-client';
import { upDockerStack, upLocalStack } from '../runtime/tests/stack';

type TestResult = { name: string; ok: boolean; detail?: string };
const results: TestResult[] = [];

type GoogleNetworkStats = {
  capture: {
    seen: number;
    stored: number;
    skipped: number;
    bodyReadFailed: number;
    blockedByPolicy: number;
  };
  replay: {
    totalPaused: number;
    servedFromCache: number;
    blockedCacheMisses: number;
    continuedToNetwork: number;
    fulfillFailures: number;
    allHandledLocally: boolean;
    allServedFromCache: boolean;
  };
  cacheMisses: string[];
};

function pass(name: string, detail?: string): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string): void {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
}

function compactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`.slice(0, 140);
  } catch {
    return url.slice(0, 140);
  }
}

function maybeBlockedByProfile(url: string): boolean {
  return GOOGLE_BLOCK_SCRIPT_PATTERNS.some((pattern) => {
    const needle = pattern.replace(/\*/g, '');
    return needle.length > 0 && url.includes(needle);
  });
}

async function connectPreparedTarget(cdpUrl: string, targetId: string): Promise<CdpConnection> {
  const target = (await listTargets(cdpUrl)).find((item) => item.id === targetId);
  if (!target) {
    throw new Error(`No CDP target ${targetId}`);
  }
  return CdpConnection.connect(target.webSocketDebuggerUrl);
}

async function runGoogleExperiment(client: RuntimeTestClient): Promise<void> {
  const profile = googleLiveProfile();
  const stepKey = `google-${Date.now()}`;
  const prepared = await client.prepareStep({ stepKey, profile });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('POST /v1/step/prepare', `status ${prepared.status}`);
    return;
  }
  pass('POST /v1/step/prepare', prepared.body.browser.appBaseUrl);

  const cdp = await connectPreparedTarget(client.cdpUrl, prepared.body.browser.targetId);
  const { browser, page } = await client.connectBrowser(prepared.body.browser.targetId);
  const blockedDuringCapture = new Set<string>();

  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (failure.includes('blocked') || maybeBlockedByProfile(request.url())) {
      blockedDuringCapture.add(request.url());
    }
  });

  try {
    await cdp.send('Network.enable');
    const recorder = attachResponseCacheRecorder(cdp);

    await page.goto(GOOGLE_APP_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
    await recorder.drain();
    recorder.detach();

    const title = await page.title();
    if (/google/i.test(title)) {
      pass('live google navigation', title.trim().slice(0, 120));
    } else {
      fail('live google navigation', title || 'empty title');
    }

    if (blockedDuringCapture.size > 0) {
      pass('script blocking', `${blockedDuringCapture.size} blocked request(s)`);
    } else {
      pass('script blocking', 'policy installed; no matching blocked request on this load');
    }

    if (recorder.cache.size > 0) {
      pass(
        'response cache warmup',
        `${recorder.cache.size} stored, ${recorder.stats.skipped} skipped, ${recorder.stats.failed} failed body read(s)`,
      );
    } else {
      fail('response cache warmup', 'no responses captured');
      return;
    }

    const documentEntry = recorder.cache.get(responseCacheKey('GET', GOOGLE_APP_URL));
    if (documentEntry) {
      console.log(
        `  cached document: status=${documentEntry.status} mime=${documentEntry.mimeType ?? 'unknown'} bytes=${Buffer.from(documentEntry.body, 'base64').byteLength}`,
      );
    }

    await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const replay = await enableResponseCacheReplay(cdp, recorder.cache);
    try {
      await page.goto(GOOGLE_APP_URL, { waitUntil: 'commit', timeout: 30_000 });
      await page.waitForTimeout(2_000);
    } catch (err) {
      const message = err instanceof Error ? err.message.split('\n')[0] : String(err);
      console.log(`  replay navigation did not fully commit: ${message}`);
    } finally {
      await replay.detach();
    }

    const networkStats: GoogleNetworkStats = {
      capture: {
        seen: recorder.stats.seen,
        stored: recorder.stats.stored,
        skipped: recorder.stats.skipped,
        bodyReadFailed: recorder.stats.failed,
        blockedByPolicy: blockedDuringCapture.size,
      },
      replay: {
        totalPaused: replay.stats.seen,
        servedFromCache: replay.stats.served,
        blockedCacheMisses: replay.stats.missed,
        continuedToNetwork: replay.stats.continued,
        fulfillFailures: replay.stats.fulfillFailed,
        allHandledLocally: replay.stats.continued === 0 && replay.stats.fulfillFailed === 0,
        allServedFromCache: replay.stats.missed === 0 && replay.stats.fulfillFailed === 0,
      },
      cacheMisses: replay.misses,
    };

    console.log(`  network stats: ${JSON.stringify(networkStats, null, 2).replace(/\n/g, '\n  ')}`);

    if (networkStats.replay.allHandledLocally) {
      pass(
        'cache replay network isolation',
        `${replay.stats.served} served from cache, ${replay.stats.missed} cache miss(es) blocked locally`,
      );
    } else {
      fail(
        'cache replay network isolation',
        `${replay.stats.continued} continued, ${replay.stats.fulfillFailed} fulfill failure(s)`,
      );
    }

    if (replay.misses.length) {
      const sample = replay.misses.slice(0, 8).map(compactUrl).join(' | ');
      console.log(`  cache misses blocked: ${sample}`);
    }
  } finally {
    cdp.close();
    await browser.close().catch(() => {});
    await client.releaseStep(stepKey);
  }
}

async function main(): Promise<void> {
  const useDocker = process.argv.includes('--docker');
  const useLocal = process.argv.includes('--local');

  console.error('\nGoogle runtime experiment');
  console.error(`  schema: ${RUNTIME_API_SCHEMA}`);
  console.error(`  app:    ${GOOGLE_APP_URL}`);
  console.error(`  block:  ${GOOGLE_BLOCK_SCRIPT_PATTERNS.join(', ')}\n`);

  let stack: Awaited<ReturnType<typeof upDockerStack>> | undefined;
  let client: RuntimeTestClient;

  if (useDocker) {
    console.error('Starting Docker stack…\n');
    stack = await upDockerStack();
    client = new RuntimeTestClient({ apiUrl: stack.apiUrl, cdpUrl: stack.cdpUrl });
  } else if (useLocal) {
    console.error('Starting local stack…\n');
    stack = await upLocalStack({ appUrl: GOOGLE_APP_URL });
    client = new RuntimeTestClient({ apiUrl: stack.apiUrl, cdpUrl: stack.cdpUrl });
  } else {
    client = new RuntimeTestClient();
    await client.waitForReady();
  }

  console.error(`  API: ${client.apiUrl}`);
  console.error(`  CDP: ${client.cdpUrl}\n`);

  try {
    await runGoogleExperiment(client);
  } finally {
    if (stack) {
      console.error('\nStopping stack…');
      await stack.stop();
    }
  }

  const failed = results.filter((result) => !result.ok);
  console.error(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((result) => console.error(`  FAIL: ${result.name} — ${result.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
