import type { Profile } from '../lab/types';
import { buildRuntimeEnvironmentId } from './profile-slice';
import { resolveNetworkTarget, type ResolveNetworkOptions } from './network';
import { networkPolicyEnv, resolveNetworkPolicy } from './network-policy';
import type { RuntimeContext } from './types';

export type PrepareRuntimeOptions = ResolveNetworkOptions;

/** Builds env for runtime concerns: network target, network policy, warmup, slowdown. */
export function prepareRuntimeContext(
  profile: Profile,
  options: PrepareRuntimeOptions = {},
): RuntimeContext {
  const network = resolveNetworkTarget(profile, options);
  const policy = resolveNetworkPolicy(profile);

  const env: Record<string, string> = {
    BENCH_WARMUP: profile.warmup,
    BENCH_NETWORK_KIND: network.kind,
    BENCH_API_MODE: profile.application.apiMode,
    ...networkPolicyEnv(profile),
  };

  if (profile.slowdown?.clickByTestId) {
    env['BENCH_SLOW_CLICK_JSON'] = JSON.stringify(profile.slowdown.clickByTestId);
  }
  if (profile.slowdown?.keydownByTestId) {
    env['BENCH_SLOW_KEYDOWN_JSON'] = JSON.stringify(profile.slowdown.keydownByTestId);
  }

  if (network.proxyUrl) {
    env['BENCH_PROXY_URL'] = network.proxyUrl;
  }

  return {
    profileId: profile.id,
    runtimeEnvironmentId: buildRuntimeEnvironmentId(profile, network, policy),
    network,
    policy,
    baseUrl: network.baseUrl,
    env,
  };
}
