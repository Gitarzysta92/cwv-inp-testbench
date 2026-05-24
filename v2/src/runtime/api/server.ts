#!/usr/bin/env node
import * as http from 'http';
import { waitForBrowserAppliance } from '../driver/wait-for-browser';
import { prepareRuntimeContext } from '../prepare-context';
import { beginBrowserSession } from '../driver/apply-network-policy';
import type {
  ApiErrorResponse,
  BrowserStatusResponse,
  PrepareStepRequest,
  PrepareStepResponse,
  ReleaseStepRequest,
  ReleaseStepResponse,
  RuntimeHealthResponse,
} from './types';
import { RUNTIME_API_SCHEMA } from './types';

const PORT = Number(process.env['RUNTIME_DRIVER_PORT'] ?? 8090);
const BROWSER_CDP_URL = process.env['BROWSER_CDP_URL']?.trim();
const BROWSER_APP_BASE_URL = process.env['BROWSER_APP_BASE_URL']?.trim();
const HOST_BROWSER_CDP_URL = process.env['HOST_BROWSER_CDP_URL']?.trim();

type ActiveStep = {
  release: () => Promise<void>;
};

const activeSteps = new Map<string, ActiveStep>();

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    throw new Error('empty request body');
  }
  return JSON.parse(raw) as T;
}

function resolveBrowserCdpUrl(): string {
  if (!BROWSER_CDP_URL) {
    throw new Error('BROWSER_CDP_URL is not configured on runtime driver');
  }
  return BROWSER_CDP_URL;
}

function resolveHostBrowserCdpUrl(): string {
  return HOST_BROWSER_CDP_URL ?? BROWSER_CDP_URL ?? 'http://127.0.0.1:9222';
}

function resolveBrowserAppBaseUrl(requestOverride?: string): string {
  return BROWSER_APP_BASE_URL ?? requestOverride?.trim() ?? 'http://127.0.0.1:4200';
}

async function handleBrowserStatus(res: http.ServerResponse): Promise<void> {
  const cdpUrl = resolveBrowserCdpUrl();
  try {
    const versionUrl = `${cdpUrl.replace(/\/$/, '')}/json/version`;
    const versionRes = await fetch(versionUrl, { signal: AbortSignal.timeout(3_000) });
    const version = versionRes.ok ? ((await versionRes.json()) as Record<string, unknown>) : undefined;
    const body: BrowserStatusResponse = {
      schema: RUNTIME_API_SCHEMA,
      ready: versionRes.ok,
      cdpUrl: resolveHostBrowserCdpUrl(),
      version,
    };
    sendJson(res, versionRes.ok ? 200 : 503, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: BrowserStatusResponse = {
      schema: RUNTIME_API_SCHEMA,
      ready: false,
      cdpUrl: resolveHostBrowserCdpUrl(),
      error: message,
    };
    sendJson(res, 503, body);
  }
}

async function handlePrepareStep(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const input = await readJsonBody<PrepareStepRequest>(req);
  if (!input.stepKey?.trim()) {
    sendJson(res, 400, {
      schema: RUNTIME_API_SCHEMA,
      error: 'stepKey is required',
    } satisfies ApiErrorResponse);
    return;
  }

  if (activeSteps.has(input.stepKey)) {
    sendJson(res, 409, {
      schema: RUNTIME_API_SCHEMA,
      error: `step "${input.stepKey}" is already active`,
    } satisfies ApiErrorResponse);
    return;
  }

  const cdpUrl = resolveBrowserCdpUrl();
  await waitForBrowserAppliance({ cdpUrl });

  const appBaseUrl = resolveBrowserAppBaseUrl(input.baseUrlOverride);
  const runtime = prepareRuntimeContext(input.profile, {
    baseUrlOverride: appBaseUrl,
  });
  runtime.env['BENCH_RUNTIME_PREPARED'] = '1';

  const session = await beginBrowserSession({
    cdpUrl,
    policy: runtime.policy,
    profile: input.profile,
  });
  activeSteps.set(input.stepKey, session);

  const body: PrepareStepResponse = {
    schema: RUNTIME_API_SCHEMA,
    stepKey: input.stepKey,
    runtime,
    browser: {
      cdpUrl: resolveHostBrowserCdpUrl(),
      appBaseUrl,
    },
    prepared: true,
  };
  sendJson(res, 200, body);
}

async function handleReleaseStep(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const input = await readJsonBody<ReleaseStepRequest>(req);
  const active = activeSteps.get(input.stepKey);
  if (!active) {
    sendJson(res, 404, {
      schema: RUNTIME_API_SCHEMA,
      error: `no active step "${input.stepKey}"`,
    } satisfies ApiErrorResponse);
    return;
  }

  await active.release();
  activeSteps.delete(input.stepKey);

  const body: ReleaseStepResponse = {
    schema: RUNTIME_API_SCHEMA,
    stepKey: input.stepKey,
    released: true,
  };
  sendJson(res, 200, body);
}

export async function startRuntimeApiServer(options?: {
  port?: number;
}): Promise<http.Server> {
  const port = options?.port ?? PORT;

  if (BROWSER_CDP_URL) {
    console.error(`Runtime driver: waiting for browser API at ${BROWSER_CDP_URL} …`);
    await waitForBrowserAppliance({ cdpUrl: BROWSER_CDP_URL });
    console.error('Runtime driver: browser API ready.\n');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        const body: RuntimeHealthResponse = {
          schema: RUNTIME_API_SCHEMA,
          status: 'ok',
          browserCdpUrl: BROWSER_CDP_URL ? resolveHostBrowserCdpUrl() : undefined,
          appBaseUrl: BROWSER_APP_BASE_URL,
        };
        sendJson(res, 200, body);
        return;
      }

      if (req.method === 'GET' && req.url === '/v1/browser/status') {
        await handleBrowserStatus(res);
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/step/prepare') {
        await handlePrepareStep(req, res);
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/step/release') {
        await handleReleaseStep(req, res);
        return;
      }

      sendJson(res, 404, { schema: RUNTIME_API_SCHEMA, error: 'not found' } satisfies ApiErrorResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { schema: RUNTIME_API_SCHEMA, error: message } satisfies ApiErrorResponse);
    }
  });

  await new Promise<void>((resolve) => server.listen(port, '0.0.0.0', resolve));
  console.error(`Runtime driver API listening on :${port} (schema ${RUNTIME_API_SCHEMA})`);
  return server;
}

async function main(): Promise<void> {
  await startRuntimeApiServer();
}

const isDirectRun = process.argv[1]?.includes('runtime/api/server');
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
