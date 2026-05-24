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
  return `${profile.id}:${profile.warmup}:${profile.application.apiMode}:${slow}:${networkEnvironmentId(network)}:${networkPolicyFingerprint(policy)}`;
}
