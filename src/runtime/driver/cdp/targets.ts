import { cdpBaseUrl, fetchJson } from './connection';

export type CdpTarget = {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
};

export async function listTargets(cdpHttpUrl: string): Promise<CdpTarget[]> {
  return fetchJson<CdpTarget[]>(`${cdpBaseUrl(cdpHttpUrl)}/json/list`);
}

export async function browserWebSocketUrl(cdpHttpUrl: string): Promise<string> {
  const version = await fetchJson<{ webSocketDebuggerUrl: string }>(
    `${cdpBaseUrl(cdpHttpUrl)}/json/version`,
  );
  return version.webSocketDebuggerUrl;
}

/** Open a fresh page target and return its CDP descriptor. */
export async function openPageTarget(cdpHttpUrl: string, url = 'about:blank'): Promise<CdpTarget> {
  const endpoint = `${cdpBaseUrl(cdpHttpUrl)}/json/new?${encodeURIComponent(url)}`;
  const res = await fetch(endpoint, { method: 'PUT', signal: AbortSignal.timeout(5_000) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${endpoint}`);
  }
  return (await res.json()) as CdpTarget;
}

export async function closeTarget(cdpHttpUrl: string, targetId: string): Promise<void> {
  await fetch(`${cdpBaseUrl(cdpHttpUrl)}/json/close/${targetId}`, {
    method: 'GET',
    signal: AbortSignal.timeout(5_000),
  });
}
