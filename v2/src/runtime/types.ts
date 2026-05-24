import type { WarmupPolicy } from '../lab/types';
import type { ResolvedNetworkTarget } from './network';
import type { ResolvedNetworkPolicy } from './network-policy';

/** Resolved runtime env passed to clients (warmup, slowdown, network target + policy). */
export type RuntimeContext = {
  profileId: string;
  runtimeEnvironmentId: string;
  network: ResolvedNetworkTarget;
  policy: ResolvedNetworkPolicy;
  /** Convenience alias for network.baseUrl (PLAYWRIGHT_BASE_URL in client spawn). */
  baseUrl: string;
  env: Record<string, string>;
};

export type RuntimeProfileView = {
  id: string;
  warmup: WarmupPolicy;
  network: { kind: string; baseUrl?: string; blockScripts?: string[] };
  application: { apiMode: string };
  slowdown?: {
    clickByTestId?: Record<string, number>;
    keydownByTestId?: Record<string, number>;
  };
};
