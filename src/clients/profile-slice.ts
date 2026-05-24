import type { Profile } from '../lab/types';

export function clientSlice(profile: Profile) {
  return {
    device: profile.device,
    system: profile.system,
    browser: profile.browser,
  };
}
