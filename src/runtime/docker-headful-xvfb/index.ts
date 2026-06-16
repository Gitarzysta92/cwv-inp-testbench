import type { BenchRuntime } from '../bench-runtime';
import { runtimeContainerName } from '../bench-runtime';
import { upDockerStack } from '../tests/stack';

export const dockerHeadfulXvfbRuntime: BenchRuntime = {
  id: 'docker-headful-xvfb',
  label: 'Docker Chromium headful via Xvfb',
  hostClass: 'runtime-docker-headful-xvfb',
  browserHeadless: false,
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
