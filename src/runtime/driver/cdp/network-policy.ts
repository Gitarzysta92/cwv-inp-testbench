import type { Profile } from '../../../lab/types';
import type { ResolvedNetworkPolicy } from '../../network-policy';
import { catalogItemsBody, productDemoBody } from '../mock-fixtures';
import type { CdpConnection } from './connection';

function toBlockedUrlPattern(glob: string): string {
  return glob.replace(/\*\*/g, '*').replace(/^\//, '');
}

function mockBodyForUrl(url: string): string | undefined {
  if (url.includes('/api/items')) {
    return catalogItemsBody;
  }
  if (url.includes('/api/product/demo')) {
    return productDemoBody;
  }
  return undefined;
}

export type NetworkPolicyHandle = {
  detach: () => void;
};

/** Apply Fetch + Network blocking over CDP. Session must stay open while step is active. */
export function applyNetworkPolicy(
  cdp: CdpConnection,
  policy: ResolvedNetworkPolicy,
): NetworkPolicyHandle {
  if (!policy.mockApi) {
    return {
      detach: () => {},
    };
  }

  const onFetchPaused = async (params: Record<string, unknown>): Promise<void> => {
    try {
      const requestId = params['requestId'] as string;
      const request = params['request'] as { url?: string } | undefined;
      const url = request?.url ?? '';

      if (policy.mockApi) {
        const body = mockBodyForUrl(url);
        if (body) {
          await cdp.send('Fetch.fulfillRequest', {
            requestId,
            responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }],
            body: Buffer.from(body).toString('base64'),
          });
          return;
        }
      }

      await cdp.send('Fetch.continueRequest', { requestId });
    } catch {
      /* connection may be closing */
    }
  };

  cdp.on('Fetch.requestPaused', onFetchPaused);

  return {
    detach: () => {
      cdp.off('Fetch.requestPaused', onFetchPaused);
    },
  };
}

export async function enableNetworkPolicy(cdp: CdpConnection, policy: ResolvedNetworkPolicy): Promise<void> {
  await cdp.send('Network.enable');

  if (policy.blockScripts.length) {
    await cdp.send('Network.setBlockedURLs', {
      urls: policy.blockScripts.map(toBlockedUrlPattern),
    });
  }

  if (policy.mockApi) {
    await cdp.send('Fetch.enable', {
      handleAuthRequests: false,
      patterns: [{ urlPattern: '*', requestStage: 'Request' }],
    });
  }
}

export async function applyDeviceProfile(cdp: CdpConnection, profile: Profile): Promise<void> {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: profile.device.width,
    height: profile.device.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Emulation.setLocaleOverride', { locale: profile.system.locale });
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: profile.system.timezoneId });
}

export async function disableNetworkPolicy(cdp: CdpConnection, policy: ResolvedNetworkPolicy): Promise<void> {
  if (policy.mockApi) {
    await cdp.send('Fetch.disable').catch(() => {});
  }
  if (policy.blockScripts.length) {
    await cdp.send('Network.setBlockedURLs', { urls: [] }).catch(() => {});
  }
  await cdp.send('Network.disable').catch(() => {});
}
