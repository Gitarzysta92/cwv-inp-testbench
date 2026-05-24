import type { ClientId } from './types';

export type RunnerKind = 'playwright-subprocess' | 'node-subprocess';

/** Client metadata — implementations live under src/clients/. */
export type ClientCatalogEntry = {
  id: ClientId;
  label: string;
  runner: RunnerKind;
  inpSource: string;
  scenarioFilterEnvKey?: string;
};

export const clientCatalog: Record<ClientId, ClientCatalogEntry> = {
  'playwright-web-vitals': {
    id: 'playwright-web-vitals',
    label: 'Playwright + web-vitals onINP',
    runner: 'playwright-subprocess',
    inpSource: 'web-vitals/onINP',
    scenarioFilterEnvKey: 'BENCH_SCENARIO_ID',
  },
  'puppeteer-lh-timespan': {
    id: 'puppeteer-lh-timespan',
    label: 'Puppeteer + Lighthouse timespan INP',
    runner: 'node-subprocess',
    inpSource: 'lighthouse/timespan',
  },
};

export function resolveClient(id: ClientId): ClientCatalogEntry {
  const entry = clientCatalog[id];
  if (!entry) {
    throw new Error(`Unknown client id: ${id}`);
  }
  return entry;
}

export function listClientIds(): ClientId[] {
  return Object.keys(clientCatalog) as ClientId[];
}
