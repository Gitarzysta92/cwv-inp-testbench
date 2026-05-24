import type { ClientId } from '../lab/types';
import type { BenchClient } from './types';
import { PlaywrightWebVitalsClient } from './playwright-web-vitals/client';
import { PuppeteerLhTimespanClient } from './puppeteer-lh-timespan/client';

const implementations: Record<ClientId, BenchClient> = {
  'playwright-web-vitals': new PlaywrightWebVitalsClient(),
  'puppeteer-lh-timespan': new PuppeteerLhTimespanClient(),
};

export function getBenchClient(id: ClientId): BenchClient {
  const client = implementations[id];
  if (!client) {
    throw new Error(`No bench client for "${id}"`);
  }
  return client;
}
