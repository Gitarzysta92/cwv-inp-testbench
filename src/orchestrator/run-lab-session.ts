import { randomUUID } from 'crypto';
import { createLabResultsService, validateLab } from '../lab';
import { reportStoragePaths } from '../lab/report';
import { prepareRuntimeContext } from '../runtime';
import { resolveBrowserConnect } from '../clients';
import type { ClientId, LabDefinition, LabReport, Observation } from '../lab/types';
import type { RuntimeContext } from '../runtime/types';
import { getBenchClient } from '../clients/registry';
import { RuntimeApiClient } from './runtime-api-client';
import { buildScheduleForLab, type OrchestratorRunInstruction } from './scheduler';

export type RunLabSessionOptions = {
  definition: LabDefinition;
  repoRoot: string;
  baseUrl?: string;
  runtimeApiUrl?: string;
  runtimeApiFactory?: (input: {
    definition: LabDefinition;
    repoRoot: string;
    sessionId: string;
    instruction: OrchestratorRunInstruction;
  }) => Promise<RuntimeApiLease>;
};

export type RunLabSessionResult = {
  sessionId: string;
  observations: Observation[];
  report: LabReport;
  failures: number;
};

export type RuntimeApiLease = {
  client: RuntimeApiClient;
  baseUrl?: string;
  description?: string;
  close: () => Promise<void>;
};

export async function runLabSession(options: RunLabSessionOptions): Promise<RunLabSessionResult> {
  const { definition, repoRoot } = options;
  if (options.runtimeApiUrl && options.runtimeApiFactory) {
    throw new Error('runtimeApiUrl and runtimeApiFactory are mutually exclusive');
  }
  validateLab(definition);

  const sessionId = randomUUID();
  const { observationsDir, summaryDir } = reportStoragePaths(repoRoot, sessionId);
  const clientsUsed: ClientId[] = [definition.lab.client];
  const results = createLabResultsService(definition);
  const schedule = buildScheduleForLab(definition, {
    kind: options.runtimeApiFactory
      ? 'isolated-runtime-api'
      : options.runtimeApiUrl
        ? 'shared-runtime-api'
        : 'local-process',
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

  for (const instruction of schedule) {
    const profile = definition.profiles.find((p) => p.id === instruction.profileId)!;
    const scenario = definition.scenarios.find((s) => s.id === instruction.scenarioId)!;

    let runtime: RuntimeContext;
    let runtimeLease: RuntimeApiLease | undefined;
    const stepKey = `${sessionId}-${instruction.instructionIndex}`;

    try {
      if (options.runtimeApiFactory) {
        runtimeLease = await options.runtimeApiFactory({
          definition,
          repoRoot,
          sessionId,
          instruction,
        });
        const health = await runtimeLease.client.waitForReady();
        console.error(
          `Using runtime driver API at ${runtimeLease.client.baseUrl} (app ${health.appBaseUrl ?? 'n/a'})` +
            `${runtimeLease.description ? ` via ${runtimeLease.description}` : ''}`,
        );
      }

      const stepRuntimeApi = runtimeLease?.client ?? runtimeApi;

      if (stepRuntimeApi) {
        const prepared = await stepRuntimeApi.prepareStep({
          profile,
          baseUrlOverride: runtimeLease?.baseUrl ?? options.baseUrl,
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
        `\n━━━ instruction ${instruction.instructionIndex + 1}/${schedule.length}: ` +
          `profile=${profile.id} scenario=${scenario.id} runReplay=${instruction.runReplay} client=${instruction.clientId} ` +
          `browser=${browserConnect.mode}${browserConnect.cdpUrl ? `@${browserConnect.cdpUrl}` : ''} ` +
          `network=${runtime.network.kind}@${runtime.network.baseUrl} ` +
          `policy=${runtime.policy.mockApi ? 'mock-api' : 'live-api'}${runtime.policy.blockScripts.length ? `+block${runtime.policy.blockScripts.length}` : ''} ` +
          `${stepRuntimeApi ? 'runtime-api ' : ''}runtime=${runtime.runtimeEnvironmentId} setup=${instruction.runtime.kind}:${instruction.runtime.isolationKey} ━━━\n`,
      );

      const observation = await getBenchClient(instruction.clientId).runScenario({
        definition,
        step: instruction,
        runtime,
        sessionId,
        observationsDir,
        repoRoot,
      });

      results.writeRawObservation(observationsDir, observation);
      observations.push(observation);

      if (observation.meta.status === 'failed') {
        failures += 1;
      }
    } finally {
      const stepRuntimeApi = runtimeLease?.client ?? runtimeApi;
      if (stepRuntimeApi) {
        await stepRuntimeApi.releaseStep({ stepKey }).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`release failed for instruction ${instruction.instructionIndex}: ${message}`);
        });
      }
      if (runtimeLease) {
        await runtimeLease.close();
      }
    }
  }

  const report = results.createReport({ sessionId, observations, clientsUsed });
  results.writeReport(summaryDir, report);

  console.error(`\nWrote ${observations.length} observation(s) under ${observationsDir}`);
  console.error(`Wrote report under ${summaryDir}`);

  return { sessionId, observations, report, failures };
}
