import type { Browser, Page } from 'playwright';
import type { Profile } from '../../lab/types';
import type {
  BrowserStatusResponse,
  PrepareStepResponse,
  ReleaseStepResponse,
  RuntimeHealthResponse,
} from '../api/types';
import { listTargets } from '../driver/cdp/targets';

export type RuntimeClientOptions = {
  apiUrl?: string;
  cdpUrl?: string;
  timeoutMs?: number;
};

/** Thin client for runtime driver API + CDP browser attachment in tests. */
export class RuntimeTestClient {
  readonly apiUrl: string;
  readonly cdpUrl: string;
  private readonly timeoutMs: number;

  constructor(options: RuntimeClientOptions = {}) {
    this.apiUrl = (options.apiUrl ?? process.env['RUNTIME_API_URL'] ?? 'http://127.0.0.1:8090').replace(
      /\/$/,
      '',
    );
    this.cdpUrl = (options.cdpUrl ?? process.env['BROWSER_CDP_URL'] ?? 'http://127.0.0.1:9222').replace(
      /\/$/,
      '',
    );
    this.timeoutMs = options.timeoutMs ?? 60_000;
  }

  private async get<T>(path: string): Promise<{ status: number; body: T }> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return { status: res.status, body: (await res.json()) as T };
  }

  private async post<T>(path: string, body: unknown): Promise<{ status: number; body: T }> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return { status: res.status, body: (await res.json()) as T };
  }

  async waitForReady(): Promise<RuntimeHealthResponse> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      try {
        const res = await this.get<RuntimeHealthResponse>('/health');
        if (res.status === 200 && res.body.status === 'ok') {
          return res.body;
        }
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Runtime API not ready at ${this.apiUrl}`);
  }

  async health(): Promise<{ status: number; body: RuntimeHealthResponse }> {
    return this.get<RuntimeHealthResponse>('/health');
  }

  async browserStatus(): Promise<{ status: number; body: BrowserStatusResponse }> {
    return this.get<BrowserStatusResponse>('/v1/browser/status');
  }

  async prepareStep(input: {
    profile: Profile;
    stepKey: string;
    baseUrlOverride?: string;
  }): Promise<{ status: number; body: PrepareStepResponse | { error: string } }> {
    return this.post('/v1/step/prepare', input);
  }

  async releaseStep(stepKey: string): Promise<{ status: number; body: ReleaseStepResponse | { error: string } }> {
    return this.post('/v1/step/release', { stepKey });
  }

  /** Attach Playwright to the page target runtime prepared (clients layer — not runtime). */
  async connectBrowser(targetId: string): Promise<{ browser: Browser; page: Page }> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const listed = await listTargets(this.cdpUrl);
      if (listed.some((t) => t.id === targetId)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    const { chromium } = await import('playwright');
    const browser = await chromium.connectOverCDP(this.cdpUrl);

    while (Date.now() < deadline) {
      for (const context of browser.contexts()) {
        for (const page of context.pages()) {
          const session = await context.newCDPSession(page);
          try {
            const info = (await session.send('Target.getTargetInfo')) as {
              targetInfo?: { targetId?: string };
            };
            if (info.targetInfo?.targetId === targetId) {
              return { browser, page };
            }
          } finally {
            await session.detach();
          }
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    await browser.close();
    throw new Error(`No page for CDP target ${targetId}`);
  }
}
