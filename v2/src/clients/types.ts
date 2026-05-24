import type {
  ClientId,
  LabDefinition,
  Observation,
  SessionStep,
} from '../lab/types';
import type { RuntimeContext } from '../runtime/types';

export type ClientRunInput = {
  definition: LabDefinition;
  step: SessionStep;
  runtime: RuntimeContext;
  sessionId: string;
  observationsDir: string;
  repoRoot: string;
};

export type BenchClient = {
  id: ClientId;
  runScenario(input: ClientRunInput): Promise<Observation>;
};

export type RunnerResult = {
  exitCode: number;
  invocationArtifactPath?: string;
};
