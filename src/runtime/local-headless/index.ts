import type { BenchRuntime } from '../bench-runtime';
import { applyProcessEnv, browserCpuThrottleEnv } from '../cpu-throttle';
import { upLocalStack } from '../tests/stack';

export const localHeadlessRuntime: BenchRuntime = {
  id: 'local-headless',
  label: 'Local Chromium headless outside Docker',
  hostClass: 'runtime-local-headless',
  browserHeadless: true,
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
      browserCpuThrottleEnv('BENCH_HEADLESS_CPU_THROTTLE_RATE'),
    );
    let stack: Awaited<ReturnType<typeof upLocalStack>>;

    try {
      stack = await upLocalStack({
        appUrl: input.profile.network.baseUrl,
        headless: true,
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
      description: `${localHeadlessRuntime.id}:api=${stack.apiUrl},cdp=${stack.cdpUrl}`,
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
