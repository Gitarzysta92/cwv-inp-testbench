import type { CdpConnection } from './connection';

type HeaderValue = string | number | boolean | string[] | undefined;

export type CachedResponse = {
  url: string;
  method: string;
  status: number;
  statusText?: string;
  mimeType?: string;
  resourceType?: string;
  responseHeaders: Array<{ name: string; value: string }>;
  body: string;
  base64Encoded: boolean;
};

export type ResponseCache = Map<string, CachedResponse>;

export type ResponseCacheRecorder = {
  cache: ResponseCache;
  stats: {
    seen: number;
    stored: number;
    skipped: number;
    failed: number;
  };
  drain: () => Promise<void>;
  detach: () => void;
};

export type ResponseCacheReplay = {
  stats: {
    seen: number;
    served: number;
    missed: number;
    continued: number;
    fulfillFailed: number;
  };
  misses: string[];
  fulfillFailureMessages: string[];
  detach: () => Promise<void>;
};

const HOP_BY_HOP_HEADERS = new Set([
  'alt-svc',
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'set-cookie',
  'set-cookie2',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function responseCacheKey(method: string, url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return `${method.toUpperCase()} ${parsed.toString()}`;
  } catch {
    return `${method.toUpperCase()} ${url}`;
  }
}

function headerEntries(headers: Record<string, HeaderValue>): Array<{ name: string; value: string }> {
  const entries: Array<{ name: string; value: string }> = [];
  for (const [name, raw] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (raw === undefined || HOP_BY_HOP_HEADERS.has(lower) || lower.startsWith(':')) {
      continue;
    }
    const value = (Array.isArray(raw) ? raw.join(', ') : String(raw)).replace(/[\r\n]+/g, ' ');
    entries.push({ name, value });
  }
  return entries;
}

function shouldStoreResponse(meta: RequestMeta, maxBodyBytes: number): boolean {
  if (meta.method !== 'GET') {
    return false;
  }
  if (!meta.status || meta.status < 200 || meta.status >= 400) {
    return false;
  }
  if (meta.encodedDataLength !== undefined && meta.encodedDataLength > maxBodyBytes) {
    return false;
  }
  return meta.url.startsWith('http://') || meta.url.startsWith('https://');
}

function replayHeaders(cached: CachedResponse): Array<{ name: string; value: string }> {
  const contentType = cached.responseHeaders.find(
    (header) => header.name.toLowerCase() === 'content-type' && header.value.trim(),
  );
  if (contentType) {
    return [contentType];
  }
  if (cached.mimeType) {
    return [{ name: 'Content-Type', value: cached.mimeType }];
  }
  return [];
}

type RequestMeta = {
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  mimeType?: string;
  resourceType?: string;
  headers?: Record<string, HeaderValue>;
  encodedDataLength?: number;
};

export function attachResponseCacheRecorder(
  cdp: CdpConnection,
  options: {
    cache?: ResponseCache;
    maxBodyBytes?: number;
  } = {},
): ResponseCacheRecorder {
  const cache = options.cache ?? new Map<string, CachedResponse>();
  const maxBodyBytes = options.maxBodyBytes ?? 10 * 1024 * 1024;
  const requests = new Map<string, RequestMeta>();
  const pending = new Set<Promise<void>>();
  const stats = {
    seen: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
  };

  const onRequestWillBeSent = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'] as string | undefined;
    const request = params['request'] as { method?: string; url?: string } | undefined;
    if (!requestId || !request?.url) {
      return;
    }
    requests.set(requestId, {
      method: request.method ?? 'GET',
      url: request.url,
    });
  };

  const onResponseReceived = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'] as string | undefined;
    const response = params['response'] as
      | {
          url?: string;
          status?: number;
          statusText?: string;
          mimeType?: string;
          headers?: Record<string, HeaderValue>;
        }
      | undefined;
    if (!requestId || !response?.url) {
      return;
    }

    const current = requests.get(requestId) ?? { method: 'GET', url: response.url };
    requests.set(requestId, {
      ...current,
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      mimeType: response.mimeType,
      resourceType: params['type'] as string | undefined,
      headers: response.headers,
    });
  };

  const onLoadingFinished = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'] as string | undefined;
    if (!requestId) {
      return;
    }

    const meta = requests.get(requestId);
    requests.delete(requestId);
    stats.seen += 1;

    if (!meta) {
      stats.skipped += 1;
      return;
    }

    const encodedDataLength = params['encodedDataLength'];
    if (typeof encodedDataLength === 'number') {
      meta.encodedDataLength = encodedDataLength;
    }

    if (!shouldStoreResponse(meta, maxBodyBytes)) {
      stats.skipped += 1;
      return;
    }

    const task = cdp
      .send('Network.getResponseBody', { requestId })
      .then((body) => {
        const responseBody = String(body['body'] ?? '');
        const base64Encoded = body['base64Encoded'] === true;
        cache.set(responseCacheKey(meta.method, meta.url), {
          url: meta.url,
          method: meta.method,
          status: meta.status ?? 200,
          statusText: meta.statusText,
          mimeType: meta.mimeType,
          resourceType: meta.resourceType,
          responseHeaders: headerEntries(meta.headers ?? {}),
          body: base64Encoded ? responseBody : Buffer.from(responseBody).toString('base64'),
          base64Encoded: true,
        });
        stats.stored += 1;
      })
      .catch(() => {
        stats.failed += 1;
      })
      .finally(() => {
        pending.delete(task);
      });

    pending.add(task);
  };

  cdp.on('Network.requestWillBeSent', onRequestWillBeSent);
  cdp.on('Network.responseReceived', onResponseReceived);
  cdp.on('Network.loadingFinished', onLoadingFinished);

  return {
    cache,
    stats,
    drain: async () => {
      await Promise.allSettled([...pending]);
    },
    detach: () => {
      cdp.off('Network.requestWillBeSent', onRequestWillBeSent);
      cdp.off('Network.responseReceived', onResponseReceived);
      cdp.off('Network.loadingFinished', onLoadingFinished);
    },
  };
}

export async function enableResponseCacheReplay(
  cdp: CdpConnection,
  cache: ResponseCache,
): Promise<ResponseCacheReplay> {
  const stats = {
    seen: 0,
    served: 0,
    missed: 0,
    continued: 0,
    fulfillFailed: 0,
  };
  const misses: string[] = [];
  const fulfillFailureMessages: string[] = [];

  const onFetchPaused = async (params: Record<string, unknown>): Promise<void> => {
    const requestId = params['requestId'] as string;
    const request = params['request'] as { method?: string; url?: string } | undefined;
    const method = request?.method ?? 'GET';
    const url = request?.url ?? '';
    const cached = cache.get(responseCacheKey(method, url));
    stats.seen += 1;

    try {
      if (cached) {
        await cdp.send('Fetch.fulfillRequest', {
          requestId,
          responseCode: cached.status,
          ...(cached.statusText ? { responsePhrase: cached.statusText } : {}),
          responseHeaders: replayHeaders(cached),
          body: cached.body,
        });
        stats.served += 1;
        return;
      }

      stats.missed += 1;
      misses.push(`${method} ${url}`);
      await cdp.send('Fetch.failRequest', {
        requestId,
        errorReason: 'BlockedByClient',
      });
    } catch (err) {
      stats.fulfillFailed += 1;
      if (fulfillFailureMessages.length < 20) {
        fulfillFailureMessages.push(err instanceof Error ? err.message : String(err));
      }
      await cdp
        .send('Fetch.failRequest', {
          requestId,
          errorReason: 'Failed',
        })
        .catch(() => {});
    }
  };

  cdp.on('Fetch.requestPaused', onFetchPaused);
  await cdp.send('Fetch.enable', {
    handleAuthRequests: false,
    patterns: [{ urlPattern: '*', requestStage: 'Request' }],
  });

  return {
    stats,
    misses,
    fulfillFailureMessages,
    detach: async () => {
      cdp.off('Fetch.requestPaused', onFetchPaused);
      await cdp.send('Fetch.disable').catch(() => {});
    },
  };
}
