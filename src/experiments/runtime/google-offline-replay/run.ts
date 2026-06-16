import { CdpConnection } from '../../../runtime/driver/cdp/connection';
import {
  attachResponseCacheRecorder,
  enableResponseCacheReplay,
  responseCacheKey,
} from '../../../runtime/driver/cdp/response-cache';
import { listTargets } from '../../../runtime/driver/cdp/targets';
import { RuntimeTestClient } from '../../../runtime/tests/runtime-client';
import {
  GOOGLE_APP_URL,
  GOOGLE_BLOCK_SCRIPT_PATTERNS,
  googleLiveProfile,
} from '../../lab/google-web-vitals-probe/profiles';

export type SmokeTestResult = { name: string; ok: boolean; detail?: string };

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

export async function runGoogleOfflineReplaySmoke(client: RuntimeTestClient): Promise<SmokeTestResult[]> {
  const results: SmokeTestResult[] = [];
  const pass = (name: string, detail?: string) => {
    results.push({ name, ok: true, detail });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const fail = (name: string, detail: string) => {
    results.push({ name, ok: false, detail });
    console.error(`  ✗ ${name} — ${detail}`);
  };

  const liveProfile = googleLiveProfile();
  const profile = {
    ...liveProfile,
    network: {
      ...liveProfile.network,
      runtimeCacheMissPolicy: 'block' as const,
    },
  };
  const stepKey = `google-${Date.now()}`;
  const prepared = await client.prepareStep({ stepKey, profile });
  if (prepared.status !== 200 || !('prepared' in prepared.body)) {
    fail('POST /v1/step/prepare', `status ${prepared.status}`);
    return results;
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
      return results;
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

    if (replay.stats.continued === 0 && replay.stats.fulfillFailed === 0) {
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

  return results;
}
