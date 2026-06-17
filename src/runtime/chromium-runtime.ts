import type { Profile } from '../lab/types';
import type {
  BenchRuntime,
  BenchRuntimeStartInput,
  StartedBenchRuntime,
} from './bench-runtime';
import { runtimeContainerName } from './bench-runtime';
import { applyProcessEnv, browserCpuThrottleEnv } from './cpu-throttle';
import { upDockerStack, upLocalStack } from './tests/stack';

export type ChromiumRuntimeDefinition = Pick<
  BenchRuntime,
  'id' | 'label' | 'hostClass' | 'browserHeadless'
>;

export type ChromiumRuntimeStarter = (
  runtime: BenchRuntime,
  input: BenchRuntimeStartInput,
) => Promise<StartedBenchRuntime>;

export function configureLiveBrowserProfile(profile: Profile): Profile {
  return {
    ...profile,
    network: {
      ...profile.network,
      runtimeNetworkCache: 'disabled',
    },
  };
}

export function createChromiumRuntime(
  definition: ChromiumRuntimeDefinition,
  starter: ChromiumRuntimeStarter,
): BenchRuntime {
  const runtime: BenchRuntime = {
    ...definition,
    configureProfile: configureLiveBrowserProfile,
    start(input) {
      return starter(runtime, input);
    },
  };

  return runtime;
}

export async function startLocalChromiumRuntime(
  runtime: BenchRuntime,
  input: BenchRuntimeStartInput,
  options: {
    headless: boolean;
    throttleEnvName: string;
  },
): Promise<StartedBenchRuntime> {
  const restoreThrottleEnv = applyProcessEnv(
    browserCpuThrottleEnv(options.throttleEnvName),
  );
  let stack: Awaited<ReturnType<typeof upLocalStack>>;

  try {
    stack = await upLocalStack({
      appUrl: input.profile.network.baseUrl,
      headless: options.headless,
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
    description: `${runtime.id}:api=${stack.apiUrl},cdp=${stack.cdpUrl}`,
    close: async () => {
      try {
        await stack.stop();
      } finally {
        restoreThrottleEnv();
      }
    },
  };
}

export async function startDockerXvfbChromiumRuntime(
  runtime: BenchRuntime,
  input: BenchRuntimeStartInput,
  options: {
    throttleEnvName: string;
  },
): Promise<StartedBenchRuntime> {
  const containerName = runtimeContainerName(
    runtime.id,
    input.sessionId,
    input.instructionIndex,
  );
  const stack = await upDockerStack({
    containerName,
    build: input.buildImage,
    env: {
      BENCH_USE_XVFB: '1',
      BROWSER_HEADLESS: '0',
      XVFB_WIDTH: String(input.profile.device.width),
      XVFB_HEIGHT: String(input.profile.device.height),
      ...browserCpuThrottleEnv(options.throttleEnvName),
    },
  });

  return {
    apiUrl: stack.apiUrl,
    cdpUrl: stack.cdpUrl,
    appUrl: stack.appUrl,
    description: `${runtime.id}:${containerName}`,
    close: stack.stop,
  };
}
