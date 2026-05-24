import type { Lab, Observation, SummaryRow } from './types';
import { OBSERVATION_METRICS } from './report';

function percentileLinear(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function trimSamples(sorted: number[], trimPercent: number): number[] {
  if (!trimPercent || trimPercent <= 0) return sorted;
  const n = sorted.length;
  const k = Math.floor((n * trimPercent) / 100);
  if (k <= 0 || n - 2 * k < 1) return sorted;
  return sorted.slice(k, n - k);
}

/** Aggregates observations into summary rows (profile × scenario × client × metric). */
export function aggregateObservations(
  observations: Observation[],
  lab: Lab,
): SummaryRow[] {
  const metricKeys = OBSERVATION_METRICS;
  const percentiles = lab.methodology.percentiles;
  const trimPercent = lab.methodology.trimExtremesPercent;

  const groups = new Map<string, number[]>();

  for (const obs of observations) {
    if (obs.meta.status !== 'ok') continue;
    for (const metric of metricKeys) {
      const value = obs.metrics[metric];
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      const key = `${obs.profileId}::${obs.scenarioId}::${obs.clientId}::${metric}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(value);
    }
  }

  const rows: SummaryRow[] = [];

  for (const [key, values] of groups) {
    const [profileId, scenarioId, clientId, metric] = key.split('::') as [
      string,
      string,
      Observation['clientId'],
      string,
    ];
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = trimSamples(sorted, trimPercent);
    const stats: Record<string, number> = {};
    for (const p of percentiles) {
      stats[`p${p}`] = Number(percentileLinear(trimmed, p).toFixed(4));
    }
    rows.push({
      profileId,
      scenarioId,
      clientId,
      metric,
      count: sorted.length,
      countUsed: trimmed.length,
      stats,
      worst: sorted.length ? sorted[sorted.length - 1] : null,
    });
  }

  rows.sort((a, b) =>
    `${a.profileId}${a.scenarioId}${a.clientId}${a.metric}`.localeCompare(
      `${b.profileId}${b.scenarioId}${b.clientId}${b.metric}`,
    ),
  );

  return rows;
}

export function summaryToTsv(rows: SummaryRow[], percentiles: number[]): string {
  const header = [
    'profileId',
    'scenarioId',
    'clientId',
    'metric',
    'n',
    ...percentiles.map((p) => `p${p}`),
    'worst',
  ];
  const lines = [header.join('\t')];
  for (const row of rows) {
    lines.push(
      [
        row.profileId,
        row.scenarioId,
        row.clientId,
        row.metric,
        row.countUsed,
        ...percentiles.map((p) => row.stats[`p${p}`] ?? ''),
        row.worst ?? '',
      ].join('\t'),
    );
  }
  return lines.join('\n') + '\n';
}
