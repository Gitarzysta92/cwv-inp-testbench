import { createChromiumRuntime, startLocalChromiumRuntime } from '../chromium-runtime';

export const localHeadlessRuntime = createChromiumRuntime({
  id: 'local-headless',
  label: 'Local Chromium headless outside Docker',
  hostClass: 'runtime-local-headless',
  browserHeadless: true,
}, (runtime, input) =>
  startLocalChromiumRuntime(runtime, input, {
    headless: true,
    throttleEnvName: 'BENCH_HEADLESS_CPU_THROTTLE_RATE',
  }),
);
