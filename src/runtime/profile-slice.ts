import type { Profile } from '../lab/types';
import { networkEnvironmentId, resolveNetworkTarget } from './network';
import { networkPolicyFingerprint, resolveNetworkPolicy } from './network-policy';

export function runtimeSlice(profile: Profile) {
  return {
    id: profile.id,
    warmup: profile.warmup,
    network: {
      kind: profile.network.kind,
      baseUrl: profile.network.baseUrl,
      blockScripts: profile.network.blockScripts,
      browserCache: profile.network.browserCache,
      runtimeNetworkCache: profile.network.runtimeNetworkCache,
    },
    application: { apiMode: profile.application.apiMode },
    slowdown: profile.slowdown,
  };
}

export function runtimeEnvironmentId(profile: Profile): string {
  const network = resolveNetworkTarget(profile);
  const policy = resolveNetworkPolicy(profile);
  return buildRuntimeEnvironmentId(profile, network, policy);
}

export function buildRuntimeEnvironmentId(
  profile: Profile,
  network: ReturnType<typeof resolveNetworkTarget>,
  policy: ReturnType<typeof resolveNetworkPolicy>,
): string {
  const slow = profile.slowdown ? 'slow' : 'noslow';
  const browserCache = profile.network.browserCache === 'disabled' ? 'bcache-off' : 'bcache-on';
  const runtimeCache =
    profile.network.runtimeNetworkCache === 'disabled' ? 'rtcache-off' : 'rtcache-on';
  return `${profile.id}:${profile.warmup}:${profile.application.apiMode}:${slow}:${networkEnvironmentId(network)}:${browserCache}:${runtimeCache}:${networkPolicyFingerprint(policy)}`;
}
