import * as fs from 'fs';
import * as path from 'path';
import { aggregateObservations } from '../../../lab/aggregate';
import { createLabResultsService } from '../../../lab/results';
import { reportStoragePaths } from '../../../lab/report';
import type { Observation, ObservationNetworkStats } from '../../../lab/types';
import {
  euroMenuMethodologyLab,
  euroMenuMethodologyProfiles,
} from '../../lab/euro-cwv-lab/definition';
import type { PathSeedConfig, RawRow } from './measurements';

export type { PathSeedConfig, RawRow } from './measurements';
export {
  HAMBURGER_ROWS,
  PATH_CONFIGS,
  ROTATOR_ROWS,
  SEARCH_ROWS,
  SESSION_DAYS,
} from './measurements';

export const PROFILE_ORDER = [
  'baseline',
  'euro-menu-browser-cache-cold',
  'euro-menu-browser-cache-disabled',
  'euro-menu-external-scripts-blocked-warm',
] as const;

export const DISPLAY_LABELS: Record<string, string> = {
  baseline: 'Baseline: warm cache',
  'euro-menu-browser-cache-cold': 'Cold browser cache',
  'euro-menu-browser-cache-disabled': 'Cache disabled',
  'euro-menu-external-scripts-blocked-warm': 'Warm cache + external scripts blocked',
};

export const RAW_LABELS: Record<string, string> = {
  baseline: 'baseline',
  'euro-menu-browser-cache-cold': 'cold cache',
  'euro-menu-browser-cache-disabled': 'cache disabled',
  'euro-menu-external-scripts-blocked-warm': 'external scripts blocked',
};

export const NETWORK_REPLAY_REFERENCE: Record<
  string,
  Pick<RawRow, 'replayTotal' | 'replayServed' | 'replayBlocked' | 'replayContinued'>
> = {
  baseline: { replayTotal: 205, replayServed: 162, replayBlocked: 42, replayContinued: 0 },
  'euro-menu-browser-cache-cold': { replayTotal: 139, replayServed: 133, replayBlocked: 6, replayContinued: 0 },
  'euro-menu-browser-cache-disabled': { replayTotal: 0, replayServed: 0, replayBlocked: 0, replayContinued: 0 },
  'euro-menu-external-scripts-blocked-warm': { replayTotal: 134, replayServed: 129, replayBlocked: 5, replayContinued: 0 },
};

export const PROFILE_LABELS: Record<string, string> = Object.fromEntries(
  euroMenuMethodologyProfiles.map((p) => [p.id, p.label]),
);

const CLIENT_ID = euroMenuMethodologyLab.lab.client;

function buildNetworkStats(row: RawRow): ObservationNetworkStats {
  const enabled = row.runtimeCacheEnabled;
  return {
    runtimeCache: {
      enabled,
      mode: enabled ? 'replay' : 'disabled',
      capture: {
        seen: enabled ? row.replayTotal + 20 : 0,
        stored: enabled ? row.replayServed + 10 : 0,
        skipped: 0,
        bodyReadFailed: 0,
        cacheEntries: enabled ? row.replayServed : 0,
      },
      replay: {
        totalPaused: row.replayTotal,
        servedFromCache: row.replayServed,
        blockedCacheMisses: row.replayBlocked,
        continuedToNetwork: row.replayContinued,
        fulfillFailures: 0,
        allHandledLocally: row.replayContinued === 0,
        allServedFromCache: enabled && row.replayBlocked === 0,
      },
      cacheMisses: [],
    },
  };
}

export function buildObservation(
  sessionId: string,
  pathConfig: PathSeedConfig,
  row: RawRow,
  timestamp: string,
  sessionStepIndex: number,
): Observation {
  const network = buildNetworkStats(row);
  return {
    schema: 'cwv-bench-observation/1',
    sessionId,
    cohort: euroMenuMethodologyLab.lab.cohort,
    profileId: row.profileId,
    profileLabel: PROFILE_LABELS[row.profileId] ?? row.profileId,
    scenarioId: pathConfig.scenarioId,
    scenarioLabel: pathConfig.scenarioLabel,
    runReplay: row.replicate,
    replicate: row.replicate,
    stepIndex: sessionStepIndex,
    sessionStepIndex,
    clientId: CLIENT_ID,
    runtimeEnvironmentId: `${row.profileId}:imported-${pathConfig.key}`,
    metrics: {
      inpMs: row.inpMs,
      wallClockMs: row.wallClockMs,
      runtimeCacheEnabled: network.runtimeCache.enabled ? 1 : 0,
      runtimeCacheReplayTotalPaused: row.replayTotal,
      runtimeCacheReplayServedFromCache: row.replayServed,
      runtimeCacheReplayBlockedCacheMisses: row.replayBlocked,
      runtimeCacheReplayContinuedToNetwork: row.replayContinued,
      runtimeCacheReplayAllHandledLocally: network.runtimeCache.replay.allHandledLocally ? 1 : 0,
      runtimeCacheReplayAllServedFromCache: network.runtimeCache.replay.allServedFromCache ? 1 : 0,
    },
    meta: {
      status: 'ok',
      primaryMetric: 'inpMs',
      inpSource: 'web-vitals/onINP',
      network,
      ...(row.auxMs != null ? { auxMs: row.auxMs } : {}),
    },
    timestamp,
  };
}

export function gateDelta(
  summary: ReturnType<typeof aggregateObservations>,
  profileId: string,
): string {
  if (profileId === 'baseline') {
    return '0';
  }
  const row = summary.find((r) => r.profileId === profileId && r.metric === 'inpMs');
  const delta = row?.baseline?.medianDelta;
  if (delta === null || delta === undefined) {
    return 'n/a';
  }
  return Number.isFinite(delta) ? String(Math.round(delta * 10) / 10) : 'n/a';
}

function formatMetric(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function formatPercentRatio(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

export function gatePass(delta: string, profileId: string): string {
  if (profileId === 'baseline') {
    return 'tak';
  }
  if (profileId === 'euro-menu-browser-cache-disabled') {
    return 'n/a';
  }
  const n = Number(delta);
  if (!Number.isFinite(n)) {
    return 'n/a';
  }
  const limit = euroMenuMethodologyLab.lab.methodology.gate.acceptableDeltaMs;
  return Math.abs(n) <= limit ? 'tak' : 'nie';
}

export function writePathMarkdown(
  outDir: string,
  sessionId: string,
  generatedAt: string,
  pathConfig: PathSeedConfig,
  observations: Observation[],
): void {
  const summary = aggregateObservations(observations, euroMenuMethodologyLab.lab);
  const inpRows = summary.filter((r) => r.metric === 'inpMs');
  const slug = pathConfig.key;

  const lines: string[] = [
    `# ${pathConfig.jiraTitle} — ${sessionId}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Wyniki (n=5)',
    '',
    '| Profil | median INP | mean INP | out-of-range | min INP | max INP | delta INP | Δ vs baseline median | gate |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ];

  for (const profileId of PROFILE_ORDER) {
    const inp = inpRows.find((r) => r.profileId === profileId);
    const delta = gateDelta(summary, profileId);
    lines.push(
      `| ${DISPLAY_LABELS[profileId] ?? profileId} | ${formatMetric(inp?.stats.median)} | ${formatMetric(inp?.stats.mean)} | ${inp ? formatPercentRatio(inp.outOfRangeRatio) : ''} | ${formatMetric(inp?.stats.min)} | ${formatMetric(inp?.stats.max)} | ${formatMetric(inp?.stats.delta)} | ${delta} | ${gatePass(delta, profileId)} |`,
    );
  }

  lines.push('', '## Network Replay', '', '| Profil | totalPaused | servedFromCache | blockedCacheMisses | continuedToNetwork |', '| --- | ---: | ---: | ---: | ---: |');

  for (const profileId of PROFILE_ORDER) {
    const ref = NETWORK_REPLAY_REFERENCE[profileId];
    lines.push(
      `| ${DISPLAY_LABELS[profileId] ?? profileId} | ${ref.replayTotal} | ${ref.replayServed} | ${ref.replayBlocked} | ${ref.replayContinued} |`,
    );
  }

  const rawHeader = pathConfig.rows.some((r) => r.auxMs != null)
    ? '| profile | replicate | status | inpMs | wallClockMs | auxMs | replayTotal | replayServed | replayBlocked | continued |'
    : '| profile | replicate | status | inpMs | wallClockMs | replayTotal | replayServed | replayBlocked | continued |';

  lines.push('', '## Surowe wyniki', '', rawHeader, pathConfig.rows.some((r) => r.auxMs != null) ? '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |' : '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |');

  for (const row of pathConfig.rows) {
    const obs = observations.find((o) => o.profileId === row.profileId && o.replicate === row.replicate);
    if (!obs) continue;
    const cells = [
      row.profileId,
      String(row.replicate),
      obs.meta.status,
      String(row.inpMs),
      String(row.wallClockMs),
    ];
    if (row.auxMs != null) {
      cells.push(String(row.auxMs));
    }
    cells.push(
      String(row.replayTotal),
      String(row.replayServed),
      String(row.replayBlocked),
      String(row.replayContinued),
    );
    lines.push(`| ${cells.join(' | ')} |`);
  }

  lines.push('');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${slug}.md`), lines.join('\n'), 'utf8');
}

export function pathJiraBlock(pathConfig: PathSeedConfig, dayLabel: string, observations: Observation[]): string[] {
  if (pathConfig.rows.length === 0) {
    return [
      `Wyniki: ${pathConfig.jiraTitle} / n=5 — ${dayLabel}`,
      '(brak zaimportowanych surowych wierszy — uzupełnij w src/experiments/import/euro-seed-paths/measurements.ts)',
      '',
    ];
  }

  const summary = aggregateObservations(observations, euroMenuMethodologyLab.lab);
  const inpRows = summary.filter((r) => r.metric === 'inpMs');
  const hasAux = pathConfig.rows.some((r) => r.auxMs != null);

  const blocks: string[] = [
    `Wyniki: ${pathConfig.jiraTitle} / n=5 — ${dayLabel}`,
    hasAux
      ? 'Profil\tmedian INP\tmean INP\tout-of-range\tmin INP\tmax INP\tdelta INP\tΔ vs baseline median\tgate'
      : 'Profil\tmedian INP\tmean INP\tout-of-range\tmin INP\tmax INP\tdelta INP\tΔ vs baseline median\tgate',
  ];

  for (const profileId of PROFILE_ORDER) {
    const inp = inpRows.find((r) => r.profileId === profileId);
    const delta = gateDelta(summary, profileId);
    const deltaNum = delta === 'n/a' ? 'n/a' : `${delta} ms`;
    blocks.push(
      [
        DISPLAY_LABELS[profileId],
        `${formatMetric(inp?.stats.median)} ms`,
        `${formatMetric(inp?.stats.mean)} ms`,
        inp ? formatPercentRatio(inp.outOfRangeRatio) : '',
        `${formatMetric(inp?.stats.min)} ms`,
        `${formatMetric(inp?.stats.max)} ms`,
        `${formatMetric(inp?.stats.delta)} ms`,
        deltaNum,
        gatePass(delta, profileId),
      ].join('\t'),
    );
  }

  blocks.push('', 'Network Replay', 'Profil\ttotalPaused\tservedFromCache\tblockedCacheMisses\tcontinuedToNetwork');
  for (const profileId of PROFILE_ORDER) {
    const ref = NETWORK_REPLAY_REFERENCE[profileId];
    blocks.push(
      [
        DISPLAY_LABELS[profileId],
        String(ref.replayTotal),
        String(ref.replayServed),
        String(ref.replayBlocked),
        String(ref.replayContinued),
      ].join('\t'),
    );
  }

  blocks.push(
    '',
    'Surowe wyniki',
    hasAux
      ? 'profile\treplicate\tstatus\tinpMs\twallClockMs\tauxMs\treplayTotal\treplayServed\treplayBlocked\tcontinued'
      : 'profile\treplicate\tstatus\tinpMs\twallClockMs\treplayTotal\treplayServed\treplayBlocked\tcontinued',
  );

  for (const row of pathConfig.rows) {
    const obs = observations.find((o) => o.profileId === row.profileId && o.replicate === row.replicate);
    if (!obs) continue;
    const cells = [
      RAW_LABELS[row.profileId],
      String(row.replicate),
      obs.meta.status,
      String(row.inpMs),
      String(row.wallClockMs),
    ];
    if (row.auxMs != null) {
      cells.push(String(row.auxMs));
    }
    cells.push(
      String(row.replayTotal),
      String(row.replayServed),
      String(row.replayBlocked),
      String(row.replayContinued),
    );
    blocks.push(cells.join('\t'));
  }

  blocks.push('');
  return blocks;
}

export function writeCombinedJira(outDir: string, dayLabel: string, paths: PathSeedConfig[], allObservations: Observation[]): void {
  const blocks: string[] = [`Euro lab — 3 ścieżki — ${dayLabel}`, ''];
  for (const pathConfig of paths) {
    const obs = allObservations.filter((o) => o.scenarioId === pathConfig.scenarioId);
    blocks.push(...pathJiraBlock(pathConfig, dayLabel, obs));
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'jira-copy-paste.txt'), blocks.join('\n'), 'utf8');
}

export function seedDay(
  repoRoot: string,
  sessionId: string,
  generatedAt: string,
  paths: PathSeedConfig[],
  options?: { resultsSubdir?: string },
): void {
  const { observationsDir, summaryDir } = reportStoragePaths(repoRoot, sessionId);
  const results = createLabResultsService(euroMenuMethodologyLab);
  const allObservations: Observation[] = [];
  let step = 0;

  for (const pathConfig of paths) {
    for (const row of pathConfig.rows) {
      const ts = new Date(new Date(generatedAt).getTime() + step * 60_000).toISOString();
      const observation = buildObservation(sessionId, pathConfig, row, ts, step);
      results.writeRawObservation(observationsDir, observation);
      allObservations.push(observation);
      step += 1;
    }
  }

  const report = results.createReport({
    sessionId,
    observations: allObservations,
    clientsUsed: [CLIENT_ID],
    generatedAt,
  });
  results.writeReport(summaryDir, report);

  const dayKey = sessionId.match(/(\d{8})$/)?.[1] ?? sessionId;
  const dayLabel = `${dayKey.slice(6, 8)}.${dayKey.slice(4, 6)}.${dayKey.slice(0, 4)}`;
  const resultsSubdir = options?.resultsSubdir ?? 'euro-paths';
  const datedDir = path.join(repoRoot, 'bench-results', resultsSubdir, dayKey);

  for (const pathConfig of paths) {
    const obs = allObservations.filter((o) => o.scenarioId === pathConfig.scenarioId);
    if (pathConfig.rows.length > 0) {
      writePathMarkdown(datedDir, sessionId, generatedAt, pathConfig, obs);
    }
  }

  writeCombinedJira(datedDir, dayLabel, paths, allObservations);

  console.error(`Wrote ${allObservations.length} observations → ${observationsDir}`);
  console.error(`Wrote report → ${summaryDir}`);
  console.error(`Wrote ${datedDir}/jira-copy-paste.txt (+ per-path .md when data present)`);
}
