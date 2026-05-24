import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  aggregateObservations,
  buildExecutionPlan,
  buildSessionPlan,
  clientIdsFromLab,
  summaryToTsv,
  validateLab,
} from '../lab';
import { REPORT_SCHEMA, reportStoragePaths } from '../lab/report';
import { prepareRuntimeContext } from '../runtime';
import { resolveBrowserConnect } from '../clients';
import type { ClientId, LabDefinition, LabReport, Observation } from '../lab/types';
import type { RuntimeContext } from '../runtime/types';
import { getBenchClient } from '../clients/registry';
import { RuntimeApiClient } from './runtime-api-client';

function writeObservation(observationsDir: string, observation: Observation): string {
  fs.mkdirSync(observationsDir, { recursive: true });
  const file = path.join(
    observationsDir,
    `${observation.profileId}__${observation.scenarioId}__${observation.clientId}__r${observation.replicate}__${observation.sessionId.slice(0, 8)}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(observation, null, 2), 'utf8');
  return file;
}

function writeReport(
  definition: LabDefinition,
  sessionId: string,
  observations: Observation[],
  summaryDir: string,
  clientsUsed: ClientId[],
): LabReport {
  const summary = aggregateObservations(observations, definition.lab);
  const report: LabReport = {
    schema: REPORT_SCHEMA,
    sessionId,
    generatedAt: new Date().toISOString(),
    cohort: definition.lab.cohort,
    methodology: definition.lab.methodology,
    clients: clientsUsed,
    observationCount: observations.length,
    summary,
  };

  fs.mkdirSync(summaryDir, { recursive: true });
  const jsonPath = path.join(summaryDir, 'report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  const tsvPath = path.join(summaryDir, 'report.tsv');
  fs.writeFileSync(
    tsvPath,
    summaryToTsv(summary, definition.lab.methodology.percentiles),
    'utf8',
  );

  return report;
}

export type RunLabSessionOptions = {
  definition: LabDefinition;
  repoRoot: string;
  baseUrl?: string;
  runtimeApiUrl?: string;
};

export type RunLabSessionResult = {
  sessionId: string;
  observations: Observation[];
  report: LabReport;
  failures: number;
};

export async function runLabSession(options: RunLabSessionOptions): Promise<RunLabSessionResult> {
  const { definition, repoRoot } = options;
  validateLab(definition);

  const sessionId = randomUUID();
  const { observationsDir, summaryDir } = reportStoragePaths(repoRoot, sessionId);

  const profileIds = definition.profiles.map((p) => p.id);
  const clientsUsed = clientIdsFromLab(definition);
  const executionPlan = buildExecutionPlan(
    profileIds,
    definition.lab.methodology.replicates,
    definition.lab.methodology.schedule,
  );
  const sessionPlan = buildSessionPlan({
    executionPlan,
    scenarios: definition.scenarios,
    clientId: definition.lab.client,
  });

  const runtimeApi = options.runtimeApiUrl
    ? new RuntimeApiClient({ baseUrl: options.runtimeApiUrl })
    : undefined;

  if (runtimeApi) {
    const health = await runtimeApi.waitForReady();
    console.error(`Using runtime driver API at ${runtimeApi.baseUrl} (app ${health.appBaseUrl})\n`);
  }

  const observations: Observation[] = [];
  let failures = 0;

  for (const step of sessionPlan) {
    const profile = definition.profiles.find((p) => p.id === step.profileId)!;
    const scenario = definition.scenarios.find((s) => s.id === step.scenarioId)!;

    let runtime: RuntimeContext;
    const stepKey = `${sessionId}-${step.sessionStepIndex}`;

    if (runtimeApi) {
      const prepared = await runtimeApi.prepareStep({
        profile,
        baseUrlOverride: options.baseUrl,
        stepKey,
      });
      runtime = prepared.runtime;
      if (prepared.browser.cdpUrl) {
        runtime.env['BROWSER_CDP_URL'] = prepared.browser.cdpUrl;
      }
      runtime.env['BROWSER_TARGET_ID'] = prepared.browser.targetId;
    } else {
      runtime = prepareRuntimeContext(profile, {
        baseUrlOverride: options.baseUrl,
      });
    }
    const browserConnect = runtime.env['BROWSER_CDP_URL']
      ? { mode: 'cdp' as const, cdpUrl: runtime.env['BROWSER_CDP_URL'] }
      : resolveBrowserConnect();

    console.error(
      `\n━━━ step ${step.sessionStepIndex + 1}/${sessionPlan.length}: ` +
        `profile=${profile.id} replicate=${step.replicate} client=${step.clientId} ` +
        `browser=${browserConnect.mode}${browserConnect.cdpUrl ? `@${browserConnect.cdpUrl}` : ''} ` +
        `network=${runtime.network.kind}@${runtime.network.baseUrl} ` +
        `policy=${runtime.policy.mockApi ? 'mock-api' : 'live-api'}${runtime.policy.blockScripts.length ? `+block${runtime.policy.blockScripts.length}` : ''} ` +
        `${runtimeApi ? 'runtime-api ' : ''}runtime=${runtime.runtimeEnvironmentId} scenario=${scenario.id} ━━━\n`,
    );

    try {
      const observation = await getBenchClient(step.clientId).runScenario({
        definition,
        step,
        runtime,
        sessionId,
        observationsDir,
        repoRoot,
      });

      writeObservation(observationsDir, observation);
      observations.push(observation);

      if (observation.meta.status === 'failed') {
        failures += 1;
      }
    } finally {
      if (runtimeApi) {
        await runtimeApi.releaseStep({ stepKey });
      }
    }
  }

  const report = writeReport(definition, sessionId, observations, summaryDir, clientsUsed);

  console.error(`\nWrote ${observations.length} observation(s) under ${observationsDir}`);
  console.error(`Wrote report under ${summaryDir}`);

  return { sessionId, observations, report, failures };
}
