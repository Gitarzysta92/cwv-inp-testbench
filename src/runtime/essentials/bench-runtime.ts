import type { Profile } from '../../lab/types';

export type BenchRuntimeStartInput = {
  profile: Profile;
  sessionId: string;
  instructionIndex: number;
  buildImage: boolean;
};

export type StartedBenchRuntime = {
  apiUrl: string;
  cdpUrl?: string;
  appUrl?: string;
  description: string;
  close: () => Promise<void>;
};

export type BenchRuntime = {
  id: string;
  label: string;
  hostClass: string;
  browserHeadless: boolean;
  configureProfile?: (profile: Profile) => Profile;
  start: (input: BenchRuntimeStartInput) => Promise<StartedBenchRuntime>;
};

export function runtimeContainerName(runtimeId: string, sessionId: string, instructionIndex: number): string {
  const safeRuntimeId = runtimeId.replace(/[^a-zA-Z0-9_.-]/g, '-');
  return `cwv-${safeRuntimeId}-${sessionId.slice(0, 8)}-${instructionIndex}`;
}
