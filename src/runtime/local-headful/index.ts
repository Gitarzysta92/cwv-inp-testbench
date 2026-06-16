import type { BenchRuntime } from '../bench-runtime';
import { applyProcessEnv, browserCpuThrottleEnv } from '../cpu-throttle';
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
    const restoreThrottleEnv = applyProcessEnv(
      browserCpuThrottleEnv('BENCH_HEADFUL_CPU_THROTTLE_RATE'),
    );
    let stack: Awaited<ReturnType<typeof upLocalStack>>;

    try {
      stack = await upLocalStack({
        appUrl: input.profile.network.baseUrl,
        headless: false,
        windowSize: input.profile.device,
      });
    } catch (err) {
      restoreThrottleEnv();
      throw err;
    }

    return {
      apiUrl: stack.apiUrl,
      cdpUrl: stack.cdpUrl,
      appUrl: stack.appUrl,
      description: `${localHeadfulRuntime.id}:api=${stack.apiUrl},cdp=${stack.cdpUrl}`,
      close: async () => {
        try {
          await stack.stop();
        } finally {
          restoreThrottleEnv();
        }
      },
    };
  },
};
