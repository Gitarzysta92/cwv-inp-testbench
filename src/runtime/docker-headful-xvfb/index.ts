import {
  createChromiumRuntime,
  startDockerXvfbChromiumRuntime,
} from '../chromium-runtime';

export const dockerHeadfulXvfbRuntime = createChromiumRuntime({
  id: 'docker-headful-xvfb',
  label: 'Docker Chromium headful via Xvfb',
  hostClass: 'runtime-docker-headful-xvfb',
  browserHeadless: false,
}, (runtime, input) =>
  startDockerXvfbChromiumRuntime(runtime, input, {
    throttleEnvName: 'BENCH_XVFB_CPU_THROTTLE_RATE',
  }),
);
