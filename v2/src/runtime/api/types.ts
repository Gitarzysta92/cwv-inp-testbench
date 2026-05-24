import type { Profile } from '../../lab/types';
import type { RuntimeContext } from '../types';

export const RUNTIME_API_SCHEMA = 'cwv-runtime-api/1';

export type RuntimeHealthResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  status: 'ok';
  browserCdpUrl?: string;
  appBaseUrl?: string;
};

export type BrowserStatusResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  ready: boolean;
  cdpUrl: string;
  version?: Record<string, unknown>;
  error?: string;
};

export type PrepareStepRequest = {
  profile: Profile;
  /** Host/orchestrator override (e.g. http://127.0.0.1:4200). Runtime may remap for in-compose browser. */
  baseUrlOverride?: string;
  stepKey: string;
};

export type PrepareStepResponse = {
  schema: typeof RUNTIME_API_SCHEMA;
  stepKey: string;
  runtime: RuntimeContext;
  browser: {
    /** CDP base URL reachable from the orchestrator / clients host. */
    cdpUrl: string;
    /** App base URL the browser process should navigate to. */
    appBaseUrl: string;
  };
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
