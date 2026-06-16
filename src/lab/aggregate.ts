import type { Lab, MetricBoundary, Observation, SummaryRow } from './types';
import { OBSERVATION_METRICS } from './report';

function roundStat(value: number): number {
  return Number(value.toFixed(4));
}

function medianSorted(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function inBoundary(value: number, boundary: MetricBoundary | undefined): boolean {
  if (!boundary) return true;
  return value >= boundary.min && value <= boundary.max;
}

function nullableDelta(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null) return null;
  return roundStat(value - baseline);
}

function gateForDelta(
  metric: string,
  lab: Lab,
  profileId: string,
  medianDelta: number | null,
): NonNullable<SummaryRow['baseline']>['gate'] {
  const baselineProfileId = lab.methodology.gate.baselineProfileId;
  if (!baselineProfileId) return 'n/a';
  if (profileId === baselineProfileId) return 'baseline';
  if (metric !== lab.methodology.metric || medianDelta === null) return 'n/a';
  return Math.abs(medianDelta) <= lab.methodology.gate.acceptableDeltaMs ? 'pass' : 'fail';
}

function observationMetricValue(obs: Observation, metric: string): number | undefined {
  if (metric === 'scenarioDurationMs') {
    return obs.metrics['scenarioDurationMs'] ?? obs.metrics['wallClockMs'];
  }
  return obs.metrics[metric];
}

/** Aggregates observations into summary rows (profile × scenario × client × metric). */
export function aggregateObservations(
  observations: Observation[],
  lab: Lab,
): SummaryRow[] {
  const groups = new Map<string, number[]>();

  for (const obs of observations) {
    if (obs.meta.status !== 'ok') continue;
    for (const metric of OBSERVATION_METRICS) {
      const value = observationMetricValue(obs, metric);
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      const key = `${obs.profileId}::${obs.scenarioId}::${obs.clientId}::${metric}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(value);
    }
  }

  const rows: SummaryRow[] = [];

  for (const [key, rawValues] of groups) {
    const [profileId, scenarioId, clientId, metric] = key.split('::') as [
      string,
      string,
      Observation['clientId'],
      string,
    ];
    const boundary = lab.methodology.metricBoundaries[metric];
    const qualified = rawValues.filter((value) => inBoundary(value, boundary));
    const outOfRange = rawValues.filter((value) => !inBoundary(value, boundary));
    const qualifiedSorted = [...qualified].sort((a, b) => a - b);
    const min = qualifiedSorted[0] ?? null;
    const max = qualifiedSorted[qualifiedSorted.length - 1] ?? null;
    const median = medianSorted(qualifiedSorted);
    const average = mean(qualifiedSorted);

    rows.push({
      profileId,
      scenarioId,
      clientId,
      metric,
      sampleCount: rawValues.length,
      qualifiedCount: qualified.length,
      outOfRangeCount: outOfRange.length,
      outOfRangeRatio: rawValues.length ? roundStat(outOfRange.length / rawValues.length) : 0,
      values: {
        raw: rawValues.map(roundStat),
        qualified: qualified.map(roundStat),
        outOfRange: outOfRange.map(roundStat),
      },
      ...(boundary ? { boundary } : {}),
      stats: {
        median: median === null ? null : roundStat(median),
        mean: average === null ? null : roundStat(average),
        min: min === null ? null : roundStat(min),
        max: max === null ? null : roundStat(max),
        delta: min === null || max === null ? null : roundStat(max - min),
      },
    });
  }

  const baselineProfileId = lab.methodology.gate.baselineProfileId;
  if (baselineProfileId) {
    for (const row of rows) {
      const baseline = rows.find(
        (candidate) =>
          candidate.profileId === baselineProfileId &&
          candidate.scenarioId === row.scenarioId &&
          candidate.clientId === row.clientId &&
          candidate.metric === row.metric,
      );
      if (!baseline) {
        row.baseline = {
          profileId: baselineProfileId,
          medianDelta: null,
          meanDelta: null,
          minDelta: null,
          maxDelta: null,
          deltaDelta: null,
          gate: 'n/a',
        };
        continue;
      }

      const medianDelta = nullableDelta(row.stats.median, baseline.stats.median);
      row.baseline = {
        profileId: baselineProfileId,
        medianDelta,
        meanDelta: nullableDelta(row.stats.mean, baseline.stats.mean),
        minDelta: nullableDelta(row.stats.min, baseline.stats.min),
        maxDelta: nullableDelta(row.stats.max, baseline.stats.max),
        deltaDelta: nullableDelta(row.stats.delta, baseline.stats.delta),
        gate: gateForDelta(row.metric, lab, row.profileId, medianDelta),
      };
    }
  }

  rows.sort((a, b) =>
    `${a.profileId}${a.scenarioId}${a.clientId}${a.metric}`.localeCompare(
      `${b.profileId}${b.scenarioId}${b.clientId}${b.metric}`,
    ),
  );

  return rows;
}

export function summaryToTsv(rows: SummaryRow[]): string {
  const header = [
    'profileId',
    'scenarioId',
    'clientId',
    'metric',
    'sampleCount',
    'qualifiedCount',
    'outOfRangeCount',
    'outOfRangeRatio',
    'boundaryMin',
    'boundaryMax',
    'median',
    'mean',
    'min',
    'max',
    'delta',
    'baselineMedianDelta',
    'baselineMeanDelta',
    'baselineDeltaDelta',
    'gate',
  ];
  const lines = [header.join('\t')];

  for (const row of rows) {
    lines.push(
      [
        row.profileId,
        row.scenarioId,
        row.clientId,
        row.metric,
        row.sampleCount,
        row.qualifiedCount,
        row.outOfRangeCount,
        row.outOfRangeRatio,
        row.boundary?.min ?? '',
        row.boundary?.max ?? '',
        row.stats.median ?? '',
        row.stats.mean ?? '',
        row.stats.min ?? '',
        row.stats.max ?? '',
        row.stats.delta ?? '',
        row.baseline?.medianDelta ?? '',
        row.baseline?.meanDelta ?? '',
        row.baseline?.deltaDelta ?? '',
        row.baseline?.gate ?? '',
      ].join('\t'),
    );
  }

  return lines.join('\n') + '\n';
}
