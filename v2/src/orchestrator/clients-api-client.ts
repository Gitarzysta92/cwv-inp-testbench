import type { LabDefinition, Observation, SessionStep } from '../lab/types';
import type { RuntimeContext } from '../runtime/types';
import {
  CLIENTS_API_SCHEMA,
  type HealthResponse,
  type RunStepRequest,
  type RunStepResponse,
} from '../clients/api/types';

export type ClientsApiClientOptions = {
  baseUrl: string;
  timeoutMs?: number;
};

export class ClientsApiClient {
  readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: ClientsApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  async waitForReady(timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const health = await this.health();
        if (health.status === 'ok') {
          return;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Clients API not ready at ${this.baseUrl} after ${timeoutMs}ms`);
  }

  async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health');
  }

  async runStep(input: {
    definition: LabDefinition;
    step: SessionStep;
    runtime: RuntimeContext;
    sessionId: string;
  }): Promise<Observation> {
    const body: RunStepRequest = {
      definition: input.definition,
      step: input.step,
      runtime: input.runtime,
      sessionId: input.sessionId,
    };
    const res = await this.post<RunStepResponse>('/v1/run-step', body);
    return res.observation;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.parseResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.parseResponse<T>(res);
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const json = (await res.json()) as T & { error?: string; schema?: string };
    if (!res.ok) {
      throw new Error(json.error ?? `Clients API ${res.status}`);
    }
    if (json.schema && json.schema !== CLIENTS_API_SCHEMA) {
      throw new Error(`unexpected API schema: ${json.schema}`);
    }
    return json;
  }
}
