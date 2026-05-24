#!/usr/bin/env node
import * as http from 'http';
import { beginBrowserSession } from '../driver/cdp/browser-session';
import { waitForBrowserAppliance } from '../driver/wait-for-browser';
import { prepareRuntimeContext } from '../prepare-context';
import type { ObservationNetworkStats } from '../../lab/types';
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

const defaultPort = () => Number(process.env['RUNTIME_DRIVER_PORT'] ?? 8090);
const browserCdpUrl = () => process.env['BROWSER_CDP_URL']?.trim();
const hostBrowserCdpUrl = () => process.env['HOST_BROWSER_CDP_URL']?.trim();

type ActiveStep = {
  release: () => Promise<ObservationNetworkStats>;
};

const activeSteps = new Map<string, ActiveStep>();
const NETWORK_KINDS = new Set(['mock-static', 'dev-server', 'live']);
const WARMUP_POLICIES = new Set(['cold', 'warm_assets', 'warm_session']);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validatePrepareStepRequest(input: unknown): string | undefined {
  if (!isRecord(input)) {
    return 'request body must be an object';
  }
  if (!isNonEmptyString(input['stepKey'])) {
    return 'stepKey is required';
  }

  const profile = input['profile'];
  if (!isRecord(profile)) {
    return 'profile is required';
  }
  if (!isNonEmptyString(profile['id'])) {
    return 'profile.id is required';
  }
  if (!WARMUP_POLICIES.has(String(profile['warmup']))) {
    return 'profile.warmup must be cold, warm_assets, or warm_session';
  }

  const network = profile['network'];
  if (!isRecord(network)) {
    return 'profile.network is required';
  }
  if (!NETWORK_KINDS.has(String(network['kind']))) {
    return 'profile.network.kind must be mock-static, dev-server, or live';
  }
  if (!isOptionalString(network['baseUrl']) || !isOptionalString(network['proxyUrl'])) {
    return 'profile.network baseUrl/proxyUrl must be strings when provided';
  }
  if (network['blockScripts'] !== undefined && !isStringArray(network['blockScripts'])) {
    return 'profile.network.blockScripts must be a string array when provided';
  }
  if (
    network['browserCache'] !== undefined &&
    network['browserCache'] !== 'default' &&
    network['browserCache'] !== 'disabled'
  ) {
    return 'profile.network.browserCache must be default or disabled when provided';
  }
  if (
    network['runtimeNetworkCache'] !== undefined &&
    network['runtimeNetworkCache'] !== 'default' &&
    network['runtimeNetworkCache'] !== 'disabled'
  ) {
    return 'profile.network.runtimeNetworkCache must be default or disabled when provided';
  }

  const application = profile['application'];
  if (!isRecord(application) || !isNonEmptyString(application['apiMode'])) {
    return 'profile.application.apiMode is required';
  }

  const device = profile['device'];
  if (
    !isRecord(device) ||
    typeof device['width'] !== 'number' ||
    typeof device['height'] !== 'number' ||
    !Number.isFinite(device['width']) ||
    !Number.isFinite(device['height'])
  ) {
    return 'profile.device.width and profile.device.height must be finite numbers';
  }

  const system = profile['system'];
  if (
    !isRecord(system) ||
    !isNonEmptyString(system['locale']) ||
    !isNonEmptyString(system['timezoneId'])
  ) {
    return 'profile.system.locale and profile.system.timezoneId are required';
  }

  const baseUrlOverride = input['baseUrlOverride'];
  if (baseUrlOverride !== undefined && typeof baseUrlOverride !== 'string') {
    return 'baseUrlOverride must be a string when provided';
  }

  return undefined;
}

function validateReleaseStepRequest(input: unknown): string | undefined {
  if (!isRecord(input)) {
    return 'request body must be an object';
  }
  if (!isNonEmptyString(input['stepKey'])) {
    return 'stepKey is required';
  }
  return undefined;
}

function resolveBrowserCdpUrl(): string {
  const url = browserCdpUrl();
  if (!url) {
    throw new Error('BROWSER_CDP_URL is not configured on runtime driver');
  }
  return url;
}

function resolveHostBrowserCdpUrl(): string {
  return hostBrowserCdpUrl() ?? browserCdpUrl() ?? 'http://127.0.0.1:9222';
}

async function handleBrowserStatus(res: http.ServerResponse): Promise<void> {
  const cdpUrl = browserCdpUrl();
  if (!cdpUrl) {
    const body: BrowserStatusResponse = {
      schema: RUNTIME_API_SCHEMA,
      ready: false,
      cdpUrl: resolveHostBrowserCdpUrl(),
      error: 'BROWSER_CDP_URL is not configured on runtime driver',
    };
    sendJson(res, 503, body);
    return;
  }

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
  const input = await readJsonBody<unknown>(req);
  const validationError = validatePrepareStepRequest(input);
  if (validationError) {
    sendJson(res, 400, {
      schema: RUNTIME_API_SCHEMA,
      error: validationError,
    } satisfies ApiErrorResponse);
    return;
  }
  const prepareInput = input as PrepareStepRequest;

  if (activeSteps.has(prepareInput.stepKey)) {
    sendJson(res, 409, {
      schema: RUNTIME_API_SCHEMA,
      error: `step "${prepareInput.stepKey}" is already active`,
    } satisfies ApiErrorResponse);
    return;
  }

  const cdpUrl = resolveBrowserCdpUrl();
  await waitForBrowserAppliance({ cdpUrl });

  const configuredBaseUrl = prepareInput.baseUrlOverride?.trim();
  const runtime = prepareRuntimeContext(
    prepareInput.profile,
    configuredBaseUrl ? { baseUrlOverride: configuredBaseUrl } : {},
  );
  const appBaseUrl = runtime.baseUrl;
  runtime.env['BENCH_RUNTIME_PREPARED'] = '1';

  const session = await beginBrowserSession({
    cdpUrl,
    policy: runtime.policy,
    profile: prepareInput.profile,
    appBaseUrl,
  });
  runtime.env['BENCH_WARMUP_RESULT_JSON'] = JSON.stringify(session.warmup);
  activeSteps.set(prepareInput.stepKey, session);

  const body: PrepareStepResponse = {
    schema: RUNTIME_API_SCHEMA,
    stepKey: prepareInput.stepKey,
    runtime,
    browser: {
      cdpUrl: resolveHostBrowserCdpUrl(),
      appBaseUrl,
      targetId: session.target.id,
      warmup: session.warmup,
    },
    prepared: true,
  };
  sendJson(res, 200, body);
}

async function handleReleaseStep(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const input = await readJsonBody<unknown>(req);
  const validationError = validateReleaseStepRequest(input);
  if (validationError) {
    sendJson(res, 400, {
      schema: RUNTIME_API_SCHEMA,
      error: validationError,
    } satisfies ApiErrorResponse);
    return;
  }
  const releaseInput = input as ReleaseStepRequest;

  const active = activeSteps.get(releaseInput.stepKey);
  if (!active) {
    const body: ReleaseStepResponse = {
      schema: RUNTIME_API_SCHEMA,
      stepKey: releaseInput.stepKey,
      released: false,
    };
    sendJson(res, 200, body);
    return;
  }

  activeSteps.delete(releaseInput.stepKey);
  const network = await active.release();

  const body: ReleaseStepResponse = {
    schema: RUNTIME_API_SCHEMA,
    stepKey: releaseInput.stepKey,
    released: true,
    network,
  };
  sendJson(res, 200, body);
}

export async function startRuntimeApiServer(options?: {
  port?: number;
}): Promise<http.Server> {
  const port = options?.port ?? defaultPort();
  const cdpUrl = browserCdpUrl();

  if (cdpUrl) {
    console.error(`Runtime driver: waiting for browser API at ${cdpUrl} …`);
    await waitForBrowserAppliance({ cdpUrl });
    console.error('Runtime driver: browser API ready.\n');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        const body: RuntimeHealthResponse = {
          schema: RUNTIME_API_SCHEMA,
          status: 'ok',
          browserCdpUrl: browserCdpUrl() ? resolveHostBrowserCdpUrl() : undefined,
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
      const status = err instanceof SyntaxError || message === 'empty request body' ? 400 : 500;
      sendJson(res, status, { schema: RUNTIME_API_SCHEMA, error: message } satisfies ApiErrorResponse);
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
