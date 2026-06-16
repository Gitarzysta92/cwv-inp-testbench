import type { BenchRuntime } from '../bench-runtime';
import { upLocalStack } from '../tests/stack';

export const localHeadfulRuntime: BenchRuntime = {
  id: 'local-headful',
  label: 'Local Chromium headful outside Docker',
  hostClass: 'runtime-local-headful',
  browserHeadless: false,
  configureProfile(profile) {
    return {
      ...profile,
      network: {
        ...profile.network,
        runtimeNetworkCache: 'disabled',
      },
    };
  },
  async start(input) {
    const stack = await upLocalStack({
      appUrl: input.profile.network.baseUrl,
      headless: false,
      windowSize: input.profile.device,
    });

    return {
      apiUrl: stack.apiUrl,
      cdpUrl: stack.cdpUrl,
      appUrl: stack.appUrl,
      description: `${localHeadfulRuntime.id}:api=${stack.apiUrl},cdp=${stack.cdpUrl}`,
      close: stack.stop,
    };
  },
};
