#!/usr/bin/env node
import * as http from 'http';
import { prepareRuntimeContext } from '../prepare-context';
import type {
  ApiErrorResponse,
  PrepareStepRequest,
  PrepareStepResponse,
  ReleaseStepRequest,
  ReleaseStepResponse,
  RuntimeHealthResponse,
} from './types';
import { RUNTIME_API_SCHEMA } from './types';

const PORT = Number(process.env['RUNTIME_DRIVER_PORT'] ?? 8090);
const APP_BASE_URL = process.env['APP_BASE_URL']?.trim() ?? 'http://127.0.0.1:4200';

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

function resolveAppBaseUrl(requestOverride?: string): string {
  return requestOverride?.trim() || APP_BASE_URL;
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

  const appBaseUrl = resolveAppBaseUrl(input.baseUrlOverride);
  const runtime = prepareRuntimeContext(input.profile, {
    baseUrlOverride: appBaseUrl,
  });

  const body: PrepareStepResponse = {
    schema: RUNTIME_API_SCHEMA,
    stepKey: input.stepKey,
    runtime,
    appBaseUrl,
    prepared: true,
  };
  sendJson(res, 200, body);
}

async function handleReleaseStep(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const input = await readJsonBody<ReleaseStepRequest>(req);
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

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        const body: RuntimeHealthResponse = {
          schema: RUNTIME_API_SCHEMA,
          status: 'ok',
          appBaseUrl: APP_BASE_URL,
        };
        sendJson(res, 200, body);
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
