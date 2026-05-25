import { spawn } from 'child_process';
import * as path from 'path';
import type { LabDefinition } from '../lab/types';

export type DockerRuntimeEndpoints = {
  runtimeBaseUrl: string;
  runtimeApiUrl: string;
};

export type DockerRuntimeOptions = {
  repoRoot: string;
  definition: LabDefinition;
  composeFile?: string;
  projectName?: string;
  build?: boolean;
  appPort?: number;
  driverPort?: number;
};

const DEFAULT_COMPOSE = 'src/runtime/docker/compose.yaml';
const DEFAULT_DRIVER_PORT = 8090;
const DEFAULT_LIVE_APP_URL = 'https://www.google.com';

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

/** Start runtime container. Returns undefined for live labs (no mock app container). */
export async function upDockerRuntime(
  options: DockerRuntimeOptions,
): Promise<DockerRuntimeEndpoints | undefined> {
  if (!needsRuntimeContainer(options.definition)) {
    console.error('Orchestrator: live lab — no runtime container needed.\n');
    return undefined;
  }

  const driverPort = options.driverPort ?? DEFAULT_DRIVER_PORT;

  const args = ['up', '-d'];
  if (options.build !== false) {
    args.push('--build');
  }
  args.push('runtime');

  const code = await runCompose(args, options, {});
  if (code !== 0) {
    throw new Error(`docker compose up runtime failed with exit code ${code}`);
  }

  const runtimeBaseUrl = process.env['BROWSER_APP_BASE_URL'] ?? DEFAULT_LIVE_APP_URL;
  const runtimeApiUrl = `http://127.0.0.1:${driverPort}`;

  await waitForHttp(`${runtimeApiUrl}/health`);
  await waitForHttp(`http://127.0.0.1:9222/json/version`);

  return { runtimeBaseUrl, runtimeApiUrl };
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
