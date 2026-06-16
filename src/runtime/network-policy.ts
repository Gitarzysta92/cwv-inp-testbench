import type { Profile } from '../lab/types';

/** Runtime network policy enacted in the browser during scenarios. */
export type ResolvedNetworkPolicy = {
  mockApi: boolean;
  blockScripts: string[];
  blockScriptsMode: 'abort' | 'empty-response';
};

export function resolveNetworkPolicy(profile: Profile): ResolvedNetworkPolicy {
  return {
    mockApi: profile.application.apiMode === 'mocked',
    blockScripts: profile.network.blockScripts ?? [],
    blockScriptsMode: profile.network.blockScriptsMode ?? 'abort',
  };
}

/** Env vars consumed by e2e runtime hooks (route mocks, script abort). */
export function networkPolicyEnv(profile: Profile): Record<string, string> {
  const policy = resolveNetworkPolicy(profile);
  const env: Record<string, string> = {
    BENCH_MOCK_NETWORK: policy.mockApi ? '1' : '0',
  };

  if (policy.blockScripts.length) {
    env['BENCH_BLOCK_SCRIPTS_JSON'] = JSON.stringify(policy.blockScripts);
    env['BENCH_BLOCK_SCRIPTS_MODE'] = policy.blockScriptsMode;
  }

  return env;
}

export function networkPolicyFingerprint(policy: ResolvedNetworkPolicy): string {
  const blocked = policy.blockScripts.length
    ? `block${policy.blockScripts.length}-${policy.blockScriptsMode}`
    : 'noblock';
  const api = policy.mockApi ? 'mockapi' : 'liveapi';
  return `${api}:${blocked}`;
}
