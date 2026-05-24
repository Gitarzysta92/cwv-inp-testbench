import * as fs from 'fs';
import { resolveClient } from '../../lab/client-catalog';
import type { BenchClient, ClientRunInput } from '../types';
import type { Observation } from '../../lab/types';
import { PlaywrightRunner } from './runner';

type BenchMetricsAttachment = {
  scenarioId: string;
  metrics: Record<string, number>;
  meta?: Record<string, string | number | boolean>;
};

type PlaywrightInvocation = {
  scenarios?: Array<{
    status: string;
    metrics?: BenchMetricsAttachment;
  }>;
};

function readObservationFromArtifact(
  input: ClientRunInput,
  artifactPath: string,
  status: Observation['meta']['status'],
  error?: string,
): Observation {
  const profile = input.definition.profiles.find((p) => p.id === input.step.profileId)!;
  const scenario = input.definition.scenarios.find((s) => s.id === input.step.scenarioId)!;
  const catalog = resolveClient(input.step.clientId);
  const primaryMetric = input.definition.lab.methodology.metric;

  let metrics: Record<string, number> = {};
  let inpSource = catalog.inpSource;
  let obsStatus = status;

  if (fs.existsSync(artifactPath)) {
    const invocation = JSON.parse(
      fs.readFileSync(artifactPath, 'utf8'),
    ) as PlaywrightInvocation;
    const row = invocation.scenarios?.find(
      (s) => s.metrics?.scenarioId === input.step.scenarioId,
    );
    if (row?.metrics?.metrics) {
      metrics = row.metrics.metrics;
      if (row.metrics.meta?.['inpSource'] && typeof row.metrics.meta['inpSource'] === 'string') {
        inpSource = row.metrics.meta['inpSource'];
      }
      if (row.status !== 'passed') {
        obsStatus = 'failed';
      } else if (typeof metrics[primaryMetric] !== 'number') {
        obsStatus = 'missing_metric';
      } else {
        obsStatus = 'ok';
      }
    } else if (obsStatus === 'ok') {
      obsStatus = 'missing_metric';
    }
  }

  return {
    schema: 'cwv-bench-observation/1',
    sessionId: input.sessionId,
    cohort: input.definition.lab.cohort,
    profileId: input.step.profileId,
    profileLabel: profile.label,
    scenarioId: input.step.scenarioId,
    scenarioLabel: scenario.label,
    replicate: input.step.replicate,
    stepIndex: input.step.stepIndex,
    sessionStepIndex: input.step.sessionStepIndex,
    clientId: input.step.clientId,
    runtimeEnvironmentId: input.runtime.runtimeEnvironmentId,
    metrics,
    meta: {
      status: obsStatus,
      primaryMetric,
      inpSource,
      error,
    },
    timestamp: new Date().toISOString(),
  };
}

export class PlaywrightWebVitalsClient implements BenchClient {
  readonly id = 'playwright-web-vitals' as const;
  private readonly runner = new PlaywrightRunner();

  async runScenario(input: ClientRunInput): Promise<Observation> {
    const spawnResult = await this.runner.spawn(input);

    if (spawnResult.exitCode !== 0) {
      return readObservationFromArtifact(
        input,
        spawnResult.invocationArtifactPath ?? '',
        'failed',
        `playwright exited with code ${spawnResult.exitCode}`,
      );
    }

    if (!spawnResult.invocationArtifactPath) {
      return readObservationFromArtifact(input, '', 'failed', 'missing playwright invocation artifact');
    }

    return readObservationFromArtifact(input, spawnResult.invocationArtifactPath, 'ok');
  }
}
