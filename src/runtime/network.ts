import type { NetworkTargetKind, Profile } from '../lab/types';

export type ResolvedNetworkTarget = {
  /** URL the browser navigates to — must be reachable from the browser process/container. */
  baseUrl: string;
  kind: NetworkTargetKind;
  proxyUrl?: string;
  /** Where baseUrl came from — useful in logs and observations. */
  source: 'env' | 'profile' | 'default';
};

const DEFAULT_MOCK_BASE_URL = 'http://127.0.0.1:4200';

const DEFAULT_BY_KIND: Record<NetworkTargetKind, string> = {
  'mock-static': DEFAULT_MOCK_BASE_URL,
  'dev-server': DEFAULT_MOCK_BASE_URL,
  live: '',
};

export type ResolveNetworkOptions = {
  /** Session-level override (orchestrator option or PLAYWRIGHT_BASE_URL). */
  baseUrlOverride?: string;
};

/**
 * Resolve app target URL for this profile.
 *
 * Override chain: orchestration env → profile.network.baseUrl → kind default.
 *
 * In Docker split mode the browser container performs HTTP — use compose DNS
 * (e.g. http://app:4200), not localhost, unless the browser runs on the host.
 */
export function resolveNetworkTarget(
  profile: Profile,
  options: ResolveNetworkOptions = {},
): ResolvedNetworkTarget {
  const envOverride = options.baseUrlOverride?.trim() || process.env['PLAYWRIGHT_BASE_URL']?.trim();
  const profileUrl = profile.network.baseUrl?.trim();
  const kind = profile.network.kind;

  if (envOverride) {
    return {
      baseUrl: envOverride,
      kind,
      proxyUrl: profile.network.proxyUrl,
      source: 'env',
    };
  }

  if (profileUrl) {
    return {
      baseUrl: profileUrl,
      kind,
      proxyUrl: profile.network.proxyUrl,
      source: 'profile',
    };
  }

  const fallback = DEFAULT_BY_KIND[kind];
  if (!fallback) {
    throw new Error(
      `profile "${profile.id}" network.kind=live requires network.baseUrl or PLAYWRIGHT_BASE_URL`,
    );
  }

  return {
    baseUrl: fallback,
    kind,
    proxyUrl: profile.network.proxyUrl,
    source: 'default',
  };
}

export function networkEnvironmentId(target: ResolvedNetworkTarget): string {
  const host = safeHost(target.baseUrl);
  const proxy = target.proxyUrl ? 'proxy' : 'direct';
  return `${target.kind}:${host}:${proxy}`;
}

function safeHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl.replace(/[^a-zA-Z0-9._-]+/g, '_');
  }
}
