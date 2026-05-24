import type { BenchClient, ClientRunInput } from '../types';
import type { Observation } from '../../lab/types';
import { resolveClient } from '../../lab/client-catalog';

/** Placeholder until Puppeteer + Lighthouse timespan client is implemented. */
export class PuppeteerLhTimespanClient implements BenchClient {
  readonly id = 'puppeteer-lh-timespan' as const;

  async runScenario(input: ClientRunInput): Promise<Observation> {
    const profile = input.definition.profiles.find((p) => p.id === input.step.profileId)!;
    const scenario = input.definition.scenarios.find((s) => s.id === input.step.scenarioId)!;
    const catalog = resolveClient(this.id);

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
      metrics: {},
      meta: {
        status: 'not_implemented',
        primaryMetric: input.definition.lab.methodology.metric,
        inpSource: catalog.inpSource,
        error: 'Puppeteer + Lighthouse timespan client is not implemented yet',
      },
      timestamp: new Date().toISOString(),
    };
  }
}
