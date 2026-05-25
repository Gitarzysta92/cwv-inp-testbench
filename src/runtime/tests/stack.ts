import { spawn, type StdioOptions } from 'child_process';
import { launch as launchChrome } from 'chrome-launcher';
import * as net from 'net';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { waitForBrowserAppliance } from '../driver/wait-for-browser';
import { LIVE_APP_URL } from './fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DOCKERFILE = path.join(REPO_ROOT, 'src/runtime/Dockerfile');
const IMAGE = process.env['RUNTIME_IMAGE'] ?? 'cwv-runtime:test';
const CONTAINER = process.env['RUNTIME_CONTAINER'] ?? 'cwv-runtime-test';
const CONTAINER_CDP_PUBLIC_PORT = Number(process.env['RUNTIME_CONTAINER_CDP_PUBLIC_PORT'] ?? 9223);

export type TestStack = {
  apiUrl: string;
  cdpUrl: string;
  appUrl: string;
  stop: () => Promise<void>;
};

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

function runDocker(args: string[], options?: { stdio?: StdioOptions }): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd: REPO_ROOT, stdio: options?.stdio ?? 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function reserveLocalPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('failed to reserve local port'));
        return;
      }
      const port = address.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on('error', reject);
  });
}

/** Build and start the runtime container (Chromium + driver API). */
export async function upDockerStack(options?: {
  containerName?: string;
  build?: boolean;
  env?: Record<string, string>;
}): Promise<TestStack> {
  const apiPort = Number(process.env['RUNTIME_API_PORT'] ?? (await reserveLocalPort()));
  const cdpPort = Number(process.env['RUNTIME_CDP_PORT'] ?? (await reserveLocalPort()));
  const apiUrl = process.env['RUNTIME_API_URL'] ?? `http://127.0.0.1:${apiPort}`;
  const cdpUrl = process.env['RUNTIME_CDP_URL'] ?? `http://127.0.0.1:${cdpPort}`;

  if (options?.build ?? true) {
    const buildCode = await runDocker(['build', '-t', IMAGE, '-f', DOCKERFILE, '.']);
    if (buildCode !== 0) {
      throw new Error('docker build failed');
    }
  }

  const containerName = options?.containerName ?? CONTAINER;
  const extraEnv = Object.entries(options?.env ?? {}).flatMap(([name, value]) => [
    '-e',
    `${name}=${value}`,
  ]);

  await runDocker(['rm', '-f', containerName], { stdio: 'ignore' });

  const runCode = await runDocker([
    'run',
    '-d',
    '--name',
    containerName,
    '--shm-size=2g',
    '-p',
    `127.0.0.1:${apiPort}:8090`,
    '-p',
    `127.0.0.1:${cdpPort}:${CONTAINER_CDP_PUBLIC_PORT}`,
    '-e',
    `BROWSER_CDP_PUBLIC_PORT=${CONTAINER_CDP_PUBLIC_PORT}`,
    '-e',
    `HOST_BROWSER_CDP_URL=${cdpUrl}`,
    ...extraEnv,
    IMAGE,
  ]);
  if (runCode !== 0) {
    throw new Error('docker run failed');
  }

  await waitForHttp(`${apiUrl}/health`);
  await waitForHttp(`${cdpUrl}/json/version`);

  return {
    apiUrl,
    cdpUrl,
    appUrl: LIVE_APP_URL,
    stop: async () => {
      await runDocker(['rm', '-f', containerName], { stdio: 'ignore' });
    },
  };
}

/** Start Chromium CDP + runtime driver API on localhost (for dev without Docker). */
export async function upLocalStack(options?: {
  driverPort?: number;
  cdpPort?: number;
  appUrl?: string;
}): Promise<TestStack> {
  const driverPort = options?.driverPort ?? 8090;
  const requestedCdpPort = options?.cdpPort ?? 9222;
  const appUrl = options?.appUrl ?? LIVE_APP_URL;

  const chrome = await launchChrome({
    port: requestedCdpPort,
    chromeFlags: [
      '--headless=new',
      '--disable-background-networking',
      '--disable-extensions',
      '--no-first-run',
    ],
  });

  const cdpUrl = `http://127.0.0.1:${chrome.port}`;
  process.env['BROWSER_CDP_URL'] = cdpUrl;
  process.env['BROWSER_APP_BASE_URL'] = appUrl;
  process.env['HOST_BROWSER_CDP_URL'] = cdpUrl;
  process.env['RUNTIME_DRIVER_PORT'] = String(driverPort);

  await waitForBrowserAppliance({ cdpUrl });

  const { startRuntimeApiServer } = await import('../api/server');
  const server = await startRuntimeApiServer({ port: driverPort });
  await waitForHttp(`http://127.0.0.1:${driverPort}/health`);

  return {
    apiUrl: `http://127.0.0.1:${driverPort}`,
    cdpUrl,
    appUrl,
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await chrome.kill();
    },
  };
}
