import type { Profile } from '../../lab/types';
import type { RuntimeContext } from '../types';

export const RUNTIME_API_SCHEMA = 'cwv-runtime-api/1';

export type RuntimeHealthResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  status: 'ok';
  appBaseUrl?: string;
};

export type PrepareStepRequest = {
  profile: Profile;
  baseUrlOverride?: string;
  stepKey: string;
};

export type PrepareStepResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  stepKey: string;
  runtime: RuntimeContext;
  appBaseUrl: string;
  prepared: true;
};

export type ReleaseStepRequest = {
  stepKey: string;
};

export type ReleaseStepResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  stepKey: string;
  released: true;
};

export type ApiErrorResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  error: string;
};
