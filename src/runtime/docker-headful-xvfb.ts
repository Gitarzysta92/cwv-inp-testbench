import type { BenchRuntime } from './essentials/bench-runtime';
import { runtimeContainerName } from './essentials/bench-runtime';
import { browserCpuThrottleEnv } from './essentials/cpu-throttle';
import { upDockerStack } from './tests/stack';

export const dockerHeadfulXvfbRuntime: BenchRuntime = {
  id: 'docker-headful-xvfb',
  label: 'Docker Chromium headful via Xvfb',
  hostClass: 'runtime-docker-headful-xvfb',
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
    const containerName = runtimeContainerName(
      dockerHeadfulXvfbRuntime.id,
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
        ...browserCpuThrottleEnv('BENCH_XVFB_CPU_THROTTLE_RATE'),
      },
    });

    return {
      apiUrl: stack.apiUrl,
      cdpUrl: stack.cdpUrl,
      appUrl: stack.appUrl,
      description: `${dockerHeadfulXvfbRuntime.id}:${containerName}`,
      close: stack.stop,
    };
  },
};
