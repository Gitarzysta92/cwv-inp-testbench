import type { LabDefinition, Observation, SessionStep } from '../../lab/types';
import type { RuntimeContext } from '../../runtime/types';

export const CLIENTS_API_SCHEMA = 'cwv-clients-api/1';

export type HealthResponse = {
  schema: typeof CLIENTS_API_SCHEMA;
  status: 'ok';
  clientIds: string[];
};

export type RunStepRequest = {
  definition: LabDefinition;
  step: SessionStep;
  runtime: RuntimeContext;
  sessionId: string;
};

export type RunStepResponse = {
  schema: typeof CLIENTS_API_SCHEMA;
  observation: Observation;
};

export type ApiErrorResponse = {
  schema: typeof CLIENTS_API_SCHEMA;
  error: string;
};
