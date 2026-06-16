import type { BenchRuntime } from '../bench-runtime';
import { dockerHeadfulXvfbRuntime } from '../docker-headful-xvfb';

export const dockerHeadfulXvfbNoReplayRuntime: BenchRuntime = {
  ...dockerHeadfulXvfbRuntime,
  id: 'docker-headful-xvfb-no-replay',
  label: 'Docker Chromium headful via Xvfb, runtime cache disabled',
  hostClass: 'runtime-docker-headful-xvfb-no-replay',
  configureProfile(profile) {
    return {
      ...profile,
      network: {
        ...profile.network,
        runtimeNetworkCache: 'disabled',
      },
    };
  },
};
