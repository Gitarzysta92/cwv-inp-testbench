import { spawn } from 'child_process';
import * as path from 'path';
import type { LabDefinition } from '../lab/types';

export type DockerRuntimeEndpoints = {
  /** Host-reachable mock app URL (health checks). */
  runtimeBaseUrl: string;
  /** Runtime driver HTTP API on the host. */
  runtimeApiUrl: string;
  /** Browser CDP API published to the host. */
  browserCdpUrl: string;
  /** App base URL for navigation inside the browser container. */
  browserAppBaseUrl: string;
};

export type DockerRuntimeOptions = {
  repoRoot: string;
  definition: LabDefinition;
  composeFile?: string;
  projectName?: string;
  build?: boolean;
  appPort?: number;
  driverPort?: number;
  browserPort?: number;
};

const DEFAULT_COMPOSE = 'v2/docker/compose.runtime.yaml';
const DEFAULT_APP_PORT = 4200;
const DEFAULT_DRIVER_PORT = 8090;
const DEFAULT_BROWSER_PORT = 9222;

export function needsRuntimeContainer(definition: LabDefinition): boolean {
  return definition.profiles.some(
    (p) => p.network.kind === 'mock-static' || p.network.kind === 'dev-server',
  );
}

function runCompose(
  args: string[],
  options: DockerRuntimeOptions,
  env: Record<string, string>,
): Promise<number> {
  const composeFile = options.composeFile ?? DEFAULT_COMPOSE;
  const composePath = path.isAbsolute(composeFile)
    ? composeFile
    : path.join(options.repoRoot, composeFile);

  const composeArgs = [
    'compose',
    '-f',
    composePath,
    ...(options.projectName ? ['-p', options.projectName] : []),
    ...args,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('docker', composeArgs, {
      cwd: options.repoRoot,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** Start browser + runtime containers. Returns undefined for live labs (no mock app container). */
export async function upDockerRuntime(
  options: DockerRuntimeOptions,
): Promise<DockerRuntimeEndpoints | undefined> {
  if (!needsRuntimeContainer(options.definition)) {
    console.error('Orchestrator: live lab — no runtime container needed.\n');
    return undefined;
  }

  const appPort = options.appPort ?? DEFAULT_APP_PORT;
  const driverPort = options.driverPort ?? DEFAULT_DRIVER_PORT;
  const browserPort = options.browserPort ?? DEFAULT_BROWSER_PORT;

  const args = ['up', '-d'];
  if (options.build !== false) {
    args.push('--build');
  }
  args.push('browser', 'runtime');

  const code = await runCompose(args, options, {});
  if (code !== 0) {
    throw new Error(`docker compose up browser+runtime failed with exit code ${code}`);
  }

  const runtimeBaseUrl = `http://127.0.0.1:${appPort}`;
  const runtimeApiUrl = `http://127.0.0.1:${driverPort}`;
  const browserCdpUrl = `http://127.0.0.1:${browserPort}`;
  const browserAppBaseUrl = 'http://runtime:4200';

  await waitForHttp(runtimeBaseUrl);
  await waitForHttp(`${runtimeApiUrl}/health`);
  await waitForBrowser(browserCdpUrl);

  return {
    runtimeBaseUrl,
    runtimeApiUrl,
    browserCdpUrl,
    browserAppBaseUrl,
  };
}

export async function downDockerRuntime(options: DockerRuntimeOptions): Promise<void> {
  if (!needsRuntimeContainer(options.definition)) {
    return;
  }
  const code = await runCompose(['down', '--remove-orphans'], options, {});
  if (code !== 0) {
    throw new Error(`docker compose down failed with exit code ${code}`);
  }
}

async function waitForHttp(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`HTTP target not ready at ${url} after ${timeoutMs}ms`);
}

async function waitForBrowser(cdpUrl: string, timeoutMs = 120_000): Promise<void> {
  const versionUrl = `${cdpUrl.replace(/\/$/, '')}/json/version`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(versionUrl, { signal: AbortSignal.timeout(2_000) });
      if (res.ok) {
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Browser API not ready at ${versionUrl} after ${timeoutMs}ms`);
}

/** @deprecated use upDockerRuntime */
export const upDockerStack = upDockerRuntime;
/** @deprecated use downDockerRuntime */
export const downDockerStack = downDockerRuntime;
