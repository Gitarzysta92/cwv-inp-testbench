import { createChromiumRuntime, startLocalChromiumRuntime } from '../chromium-runtime';

export const localHeadfulRuntime = createChromiumRuntime({
  id: 'local-headful',
  label: 'Local Chromium headful outside Docker',
  hostClass: 'runtime-local-headful',
  browserHeadless: false,
}, (runtime, input) =>
  startLocalChromiumRuntime(runtime, input, {
    headless: false,
    throttleEnvName: 'BENCH_HEADFUL_CPU_THROTTLE_RATE',
  }),
);
