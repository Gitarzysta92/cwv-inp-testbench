import type { LabReport, Observation, SummaryRow } from './types';

const DEFAULT_INDEX = 'cwv-bench-runs';
const INDEX_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export type OpenSearchPublishConfig = {
  url: string;
  index: string;
  username?: string;
  password?: string;
  insecureTls: boolean;
};

export type OpenSearchPublishResult = {
  index: string;
  documents: number;
};

type OpenSearchDocument = {
  id: string;
  body: Record<string, unknown>;
};

type BulkItem = {
  index?: {
    status?: number;
    error?: unknown;
  };
};

export function readOpenSearchPublishConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OpenSearchPublishConfig | undefined {
  const url = env['BENCH_OPENSEARCH_URL']?.trim();

  if (!url) {
    return undefined;
  }

  const index = env['BENCH_OPENSEARCH_INDEX']?.trim() || DEFAULT_INDEX;
  if (!INDEX_PATTERN.test(index)) {
    throw new Error(
      `BENCH_OPENSEARCH_INDEX must be a lowercase OpenSearch index name matching ${INDEX_PATTERN}`,
    );
  }

  return {
    url: url.replace(/\/+$/, ''),
    index,
    username: env['BENCH_OPENSEARCH_USERNAME']?.trim() || undefined,
    password: env['BENCH_OPENSEARCH_PASSWORD'] ?? undefined,
    insecureTls: isTruthy(env['BENCH_OPENSEARCH_INSECURE_TLS']),
  };
}

export async function publishLabSessionToOpenSearch(input: {
  config: OpenSearchPublishConfig;
  report: LabReport;
  observations: Observation[];
}): Promise<OpenSearchPublishResult> {
  const documents = labSessionDocuments(input.report, input.observations);

  if (documents.length === 0) {
    return { index: input.config.index, documents: 0 };
  }

  await ensureIndex(input.config);
  await bulkIndex(input.config, documents);

  return {
    index: input.config.index,
    documents: documents.length,
  };
}

function isTruthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function labSessionDocuments(
  report: LabReport,
  observations: Observation[],
): OpenSearchDocument[] {
  const base = {
    schema: 'cwv-bench-opensearch/1',
    sessionId: report.sessionId,
    generatedAt: report.generatedAt,
    cohort: report.cohort,
    methodology: report.methodology,
  };

  return [
    {
      id: `${report.sessionId}:session`,
      body: {
        ...base,
        documentType: 'session',
        observationCount: report.observationCount,
        clients: report.clients,
      },
    },
    ...report.summary.map((row, index) => summaryDocument(base, row, index)),
    ...observations.map((observation, index) =>
      observationDocument(base, observation, index),
    ),
  ];
}

function summaryDocument(
  base: Record<string, unknown>,
  row: SummaryRow,
  index: number,
): OpenSearchDocument {
  return {
    id: `${base['sessionId']}:summary:${index}`,
    body: {
      ...base,
      documentType: 'summary',
      profileId: row.profileId,
      scenarioId: row.scenarioId,
      clientId: row.clientId,
      metric: row.metric,
      gate: row.baseline?.gate,
      summary: row,
    },
  };
}

function observationDocument(
  base: Record<string, unknown>,
  observation: Observation,
  index: number,
): OpenSearchDocument {
  return {
    id: `${base['sessionId']}:observation:${index}`,
    body: {
      ...base,
      documentType: 'observation',
      profileId: observation.profileId,
      scenarioId: observation.scenarioId,
      clientId: observation.clientId,
      status: observation.meta.status,
      metrics: observation.metrics,
      observation,
    },
  };
}

async function ensureIndex(config: OpenSearchPublishConfig): Promise<void> {
  const path = `/${encodeURIComponent(config.index)}`;
  const current = await openSearchFetch(config, path, { method: 'HEAD' });

  if (current.ok) {
    return;
  }

  if (current.status !== 404) {
    throw new Error(
      `OpenSearch index check failed for ${config.index}: ${current.status} ${current.statusText}`,
    );
  }

  const created = await openSearchFetch(config, path, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        dynamic: true,
        properties: {
          generatedAt: { type: 'date' },
          documentType: { type: 'keyword' },
          sessionId: { type: 'keyword' },
          profileId: { type: 'keyword' },
          scenarioId: { type: 'keyword' },
          clientId: { type: 'keyword' },
          metric: { type: 'keyword' },
          status: { type: 'keyword' },
        },
      },
    }),
  });

  if (!created.ok && created.status !== 400) {
    const body = await created.text();
    throw new Error(
      `OpenSearch index creation failed for ${config.index}: ${created.status} ${body}`,
    );
  }
}

async function bulkIndex(
  config: OpenSearchPublishConfig,
  documents: OpenSearchDocument[],
): Promise<void> {
  const body = documents
    .flatMap((document) => [
      JSON.stringify({ index: { _id: document.id } }),
      JSON.stringify(document.body),
    ])
    .join('\n') + '\n';

  const response = await openSearchFetch(
    config,
    `/${encodeURIComponent(config.index)}/_bulk`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-ndjson',
      },
      body,
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenSearch bulk publish failed: ${response.status} ${text}`);
  }

  const parsed = JSON.parse(text) as { errors?: boolean; items?: BulkItem[] };
  if (!parsed.errors) {
    return;
  }

  const failures = (parsed.items ?? [])
    .filter((item) => item.index?.error)
    .slice(0, 5)
    .map((item) => JSON.stringify(item.index));

  throw new Error(`OpenSearch bulk publish had item errors: ${failures.join('; ')}`);
}

function openSearchFetch(
  config: OpenSearchPublishConfig,
  path: string,
  init: RequestInit,
): Promise<Response> {
  if (config.insecureTls && config.url.startsWith('https://')) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  }

  return fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...authHeaders(config),
      ...(init.headers ?? {}),
    },
  });
}

function authHeaders(config: OpenSearchPublishConfig): Record<string, string> {
  if (!config.username || config.password === undefined) {
    return {};
  }

  const token = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  return {
    authorization: `Basic ${token}`,
  };
}
