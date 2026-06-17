import type { Profile } from '../../../lab/types';
import type { ResolvedNetworkPolicy } from '../../essentials/network-policy';
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
  stats: {
    blockedByPolicy: number;
    blockedRequests: Array<{
      url: string;
      method?: string;
      resourceType?: string;
      blockedReason?: string;
      errorText?: string;
    }>;
  };
  detach: () => void;
};

/** Apply Fetch + Network blocking over CDP. Session must stay open while step is active. */
export function applyNetworkPolicy(
  cdp: CdpConnection,
  policy: ResolvedNetworkPolicy,
): NetworkPolicyHandle {
  const stats = {
    blockedByPolicy: 0,
    blockedRequests: [] as NetworkPolicyHandle['stats']['blockedRequests'],
  };
  const requests = new Map<string, { url: string; method?: string; resourceType?: string }>();

  const onRequestWillBeSent = (params: Record<string, unknown>): void => {
    const requestId = params['requestId'] as string | undefined;
    const request = params['request'] as { method?: string; url?: string } | undefined;
    if (!requestId || !request?.url) {
      return;
    }
    requests.set(requestId, {
      url: request.url,
      method: request.method,
      resourceType: params['type'] as string | undefined,
    });
  };

  const onLoadingFailed = (params: Record<string, unknown>): void => {
    if (!policy.blockScripts.length) {
      return;
    }
    const requestId = params['requestId'] as string | undefined;
    const blockedReason = params['blockedReason'];
    const errorText = String(params['errorText'] ?? '');
    if (blockedReason === 'inspector' || errorText.includes('ERR_BLOCKED_BY_CLIENT')) {
      const request = requestId ? requests.get(requestId) : undefined;
      stats.blockedByPolicy += 1;
      stats.blockedRequests.push({
        url: request?.url ?? '<unknown>',
        ...(request?.method ? { method: request.method } : {}),
        ...(request?.resourceType ? { resourceType: request.resourceType } : {}),
        ...(typeof blockedReason === 'string' ? { blockedReason } : {}),
        ...(errorText ? { errorText } : {}),
      });
    }
    if (requestId) {
      requests.delete(requestId);
    }
  };

  cdp.on('Network.requestWillBeSent', onRequestWillBeSent);
  cdp.on('Network.loadingFailed', onLoadingFailed);

  if (!policy.mockApi) {
    return {
      stats,
      detach: () => {
        cdp.off('Network.requestWillBeSent', onRequestWillBeSent);
        cdp.off('Network.loadingFailed', onLoadingFailed);
      },
    };
  }

  const onFetchPaused = async (params: Record<string, unknown>): Promise<void> => {
    try {
      const requestId = params['requestId'] as string;
      const request = params['request'] as { method?: string; url?: string } | undefined;
      const url = request?.url ?? '';

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

      await cdp.send('Fetch.continueRequest', { requestId });
    } catch {
      /* connection may be closing */
    }
  };

  cdp.on('Fetch.requestPaused', onFetchPaused);

  return {
    stats,
    detach: () => {
      cdp.off('Network.requestWillBeSent', onRequestWillBeSent);
      cdp.off('Network.loadingFailed', onLoadingFailed);
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
