import type {
  PrepareStepRequest,
  PrepareStepResponse,
  ReleaseStepRequest,
  ReleaseStepResponse,
  RuntimeHealthResponse,
} from '../runtime/api/types';

const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_MS = 500;

export type RuntimeApiClientOptions = {
  baseUrl: string;
  timeoutMs?: number;
};

export class RuntimeApiClient {
  readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: RuntimeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async waitForReady(): Promise<RuntimeHealthResponse> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${this.baseUrl}/health`, {
          signal: AbortSignal.timeout(2_000),
        });
        if (res.ok) {
          return (await res.json()) as RuntimeHealthResponse;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new Error(`Runtime driver API not ready at ${this.baseUrl} after ${this.timeoutMs}ms`);
  }

  async prepareStep(input: PrepareStepRequest): Promise<PrepareStepResponse> {
    const res = await fetch(`${this.baseUrl}/v1/step/prepare`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = (await res.json()) as PrepareStepResponse | { error: string };
    if (!res.ok) {
      throw new Error(`runtime prepare failed (${res.status}): ${'error' in body ? body.error : res.statusText}`);
    }
    return body as PrepareStepResponse;
  }

  async releaseStep(input: ReleaseStepRequest): Promise<ReleaseStepResponse> {
    const res = await fetch(`${this.baseUrl}/v1/step/release`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = (await res.json()) as ReleaseStepResponse | { error: string };
    if (!res.ok) {
      throw new Error(`runtime release failed (${res.status}): ${'error' in body ? body.error : res.statusText}`);
    }
    return body as ReleaseStepResponse;
  }
}
