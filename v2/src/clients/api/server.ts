#!/usr/bin/env node
import * as http from 'http';
import * as path from 'path';
import { listClientIds } from '../../lab/client-catalog';
import { ensureBrowserAppliance } from '../browser-appliance';
import { getBenchClient } from '../registry';
import type { RunStepRequest, RunStepResponse } from './types';
import { CLIENTS_API_SCHEMA } from './types';

const PORT = Number(process.env['CLIENTS_API_PORT'] ?? 8080);
const REPO_ROOT = path.resolve(process.env['CWV_REPO_ROOT'] ?? process.cwd());

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

async function handleRunStep(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const input = await readJsonBody<RunStepRequest>(req);
  const scenario = input.definition.scenarios.find((s) => s.id === input.step.scenarioId);
  if (!scenario) {
    sendJson(res, 400, {
      schema: CLIENTS_API_SCHEMA,
      error: `unknown scenario "${input.step.scenarioId}"`,
    });
    return;
  }

  const client = getBenchClient(input.definition.lab.client);
  const observation = await client.runScenario({
    definition: input.definition,
    step: input.step,
    runtime: input.runtime,
    sessionId: input.sessionId,
    observationsDir: path.join(REPO_ROOT, 'bench-results/v2/observations', input.sessionId),
    repoRoot: REPO_ROOT,
  });

  const response: RunStepResponse = {
    schema: CLIENTS_API_SCHEMA,
    observation,
  };
  sendJson(res, 200, response);
}

export async function startClientsApiServer(options?: {
  port?: number;
}): Promise<http.Server> {
  const port = options?.port ?? PORT;

  if (process.env['BROWSER_CDP_URL']) {
    await ensureBrowserAppliance();
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, {
          schema: CLIENTS_API_SCHEMA,
          status: 'ok',
          clientIds: listClientIds(),
        } satisfies import('./types').HealthResponse);
        return;
      }

      if (req.method === 'POST' && req.url === '/v1/run-step') {
        await handleRunStep(req, res);
        return;
      }

      sendJson(res, 404, { schema: CLIENTS_API_SCHEMA, error: 'not found' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { schema: CLIENTS_API_SCHEMA, error: message });
    }
  });

  await new Promise<void>((resolve) => server.listen(port, resolve));
  console.error(`Clients API listening on :${port} (schema ${CLIENTS_API_SCHEMA})`);
  return server;
}

async function main(): Promise<void> {
  await startClientsApiServer();
}

const isDirectRun = process.argv[1]?.includes('clients/api/server');
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
