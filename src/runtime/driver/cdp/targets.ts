import { cdpBaseUrl, fetchJson } from './connection';

export type CdpTarget = {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
};

function rewriteWebSocketDebuggerUrl(cdpHttpUrl: string, wsUrl: string): string {
  try {
    const cdp = new URL(cdpHttpUrl);
    const ws = new URL(wsUrl);
    ws.protocol = cdp.protocol === 'https:' ? 'wss:' : 'ws:';
    ws.hostname = cdp.hostname;
    ws.port = cdp.port;
    return ws.toString();
  } catch {
    return wsUrl;
  }
}

export async function listTargets(cdpHttpUrl: string): Promise<CdpTarget[]> {
  const targets = await fetchJson<CdpTarget[]>(`${cdpBaseUrl(cdpHttpUrl)}/json/list`);
  return targets.map((target) => ({
    ...target,
    webSocketDebuggerUrl: rewriteWebSocketDebuggerUrl(cdpHttpUrl, target.webSocketDebuggerUrl),
  }));
}

export async function browserWebSocketUrl(cdpHttpUrl: string): Promise<string> {
  const version = await fetchJson<{ webSocketDebuggerUrl: string }>(
    `${cdpBaseUrl(cdpHttpUrl)}/json/version`,
  );
  return rewriteWebSocketDebuggerUrl(cdpHttpUrl, version.webSocketDebuggerUrl);
}

/** Open a fresh page target and return its CDP descriptor. */
export async function openPageTarget(cdpHttpUrl: string, url = 'about:blank'): Promise<CdpTarget> {
  const endpoint = `${cdpBaseUrl(cdpHttpUrl)}/json/new?${encodeURIComponent(url)}`;
  const res = await fetch(endpoint, { method: 'PUT', signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${endpoint}`);
  }
  const target = (await res.json()) as CdpTarget;
  return {
    ...target,
    webSocketDebuggerUrl: rewriteWebSocketDebuggerUrl(cdpHttpUrl, target.webSocketDebuggerUrl),
  };
}

export async function closeTarget(cdpHttpUrl: string, targetId: string): Promise<void> {
  await fetch(`${cdpBaseUrl(cdpHttpUrl)}/json/close/${targetId}`, {
    method: 'GET',
    signal: AbortSignal.timeout(5_000),
  });
}
