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
import { ensureBrowserAppliance, resolveBrowserConnect } from '../clients';
import type { ClientId, LabDefinition, LabReport, Observation } from '../lab/types';
import type { RuntimeContext } from '../runtime/types';
import { getBenchClient } from '../clients/registry';
import { ClientsApiClient } from './clients-api-client';
import { RuntimeApiClient } from './runtime-api-client';
import type { ExecutionMode } from './options';

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
  execution?: ExecutionMode;
  clientsApiUrl?: string;
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

  const execution = options.execution ?? 'local';
  const runtimeApi = options.runtimeApiUrl
    ? new RuntimeApiClient({ baseUrl: options.runtimeApiUrl })
    : undefined;

  const clientsApi =
    execution === 'api'
      ? new ClientsApiClient({
          baseUrl: options.clientsApiUrl ?? process.env['CLIENTS_API_URL'] ?? 'http://127.0.0.1:8080',
        })
      : undefined;

  if (runtimeApi) {
    const health = await runtimeApi.waitForReady();
    console.error(
      `Using runtime driver API at ${runtimeApi.baseUrl}` +
        (health.browserCdpUrl ? ` (browser API ${health.browserCdpUrl})` : '') +
        '\n',
    );
  } else if (execution === 'api') {
    await clientsApi!.waitForReady();
    console.error(`Using clients API at ${clientsApi!.baseUrl}\n`);
  } else {
    const cdpUrl = await ensureBrowserAppliance();
    if (cdpUrl) {
      console.error(`Browser appliance ready at ${cdpUrl}.\n`);
    }
  }

  const observations: Observation[] = [];
  let failures = 0;
  const previousBrowserCdpUrl = process.env['BROWSER_CDP_URL'];

  try {
    for (const step of sessionPlan) {
      const profile = definition.profiles.find((p) => p.id === step.profileId)!;
      const scenario = definition.scenarios.find((s) => s.id === step.scenarioId)!;

      let runtime: RuntimeContext;
      let browserConnect = resolveBrowserConnect();
      const stepKey = `${sessionId}-${step.sessionStepIndex}`;

      if (runtimeApi) {
        const prepared = await runtimeApi.prepareStep({
          profile,
          baseUrlOverride: options.baseUrl,
          stepKey,
        });
        runtime = prepared.runtime;
        process.env['BROWSER_CDP_URL'] = prepared.browser.cdpUrl;
        browserConnect = { mode: 'cdp', cdpUrl: prepared.browser.cdpUrl };
      } else {
        runtime = prepareRuntimeContext(profile, {
          baseUrlOverride: options.baseUrl,
        });
      }

      console.error(
        `\n━━━ v2 step ${step.sessionStepIndex + 1}/${sessionPlan.length}: ` +
          `profile=${profile.id} replicate=${step.replicate} client=${step.clientId} ` +
          `browser=${browserConnect.mode}${browserConnect.cdpUrl ? `@${browserConnect.cdpUrl}` : ''} ` +
          `network=${runtime.network.kind}@${runtime.network.baseUrl} ` +
          `policy=${runtime.policy.mockApi ? 'mock-api' : 'live-api'}${runtime.policy.blockScripts.length ? `+block${runtime.policy.blockScripts.length}` : ''} ` +
          `execution=${execution}${runtimeApi ? '+runtime-api' : ''} runtime=${runtime.runtimeEnvironmentId} scenario=${scenario.id} ━━━\n`,
      );

      try {
        const observation =
          execution === 'api'
            ? await clientsApi!.runStep({
                definition,
                step,
                runtime,
                sessionId,
              })
            : await getBenchClient(step.clientId).runScenario({
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
  } finally {
    if (previousBrowserCdpUrl === undefined) {
      delete process.env['BROWSER_CDP_URL'];
    } else {
      process.env['BROWSER_CDP_URL'] = previousBrowserCdpUrl;
    }
  }

  const report = writeReport(definition, sessionId, observations, summaryDir, clientsUsed);

  console.error(`\nWrote ${observations.length} observation(s) under ${observationsDir}`);
  console.error(`Wrote report under ${summaryDir}`);

  return { sessionId, observations, report, failures };
}
