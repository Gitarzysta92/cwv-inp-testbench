import { clientCatalog } from './client-catalog';
import { OBSERVATION_METRICS } from './report';
import type { LabDefinition } from './types';

export function validateLab(definition: LabDefinition): void {
  const { lab, profiles, scenarios } = definition;

  if (!clientCatalog[lab.client]) {
    throw new Error(`lab.client "${lab.client}" is not a known client id`);
  }

  if (!profiles.length) {
    throw new Error('profiles must contain at least one profile');
  }

  const profileIds = new Set<string>();
  for (const profile of profiles) {
    if (profileIds.has(profile.id)) {
      throw new Error(`duplicate profile id: ${profile.id}`);
    }
    if (profile.network.kind === 'live' && !profile.network.baseUrl?.trim()) {
      const envUrl = process.env['PLAYWRIGHT_BASE_URL']?.trim();
      if (!envUrl) {
        throw new Error(
          `profile "${profile.id}" network.kind=live requires network.baseUrl or PLAYWRIGHT_BASE_URL`,
        );
      }
    }
    if (
      profile.network.blockScripts &&
      !Array.isArray(profile.network.blockScripts)
    ) {
      throw new Error(`profile "${profile.id}" network.blockScripts must be an array`);
    }
    profileIds.add(profile.id);
  }

  const baselineId = lab.methodology.gate.baselineProfileId;
  if (baselineId && !profileIds.has(baselineId)) {
    throw new Error(`gate.baselineProfileId "${baselineId}" is not in profiles`);
  }

  if (!scenarios.length) {
    throw new Error('scenarios must contain at least one scenario');
  }

  const scenarioIds = new Set<string>();
  for (const scenario of scenarios) {
    if (scenarioIds.has(scenario.id)) {
      throw new Error(`duplicate scenario id: ${scenario.id}`);
    }
    if (!scenario.description.length) {
      throw new Error(`scenario "${scenario.id}" must have a non-empty description`);
    }
    scenarioIds.add(scenario.id);
  }

  if (lab.methodology.replicates < 1) {
    throw new Error('methodology.replicates must be >= 1');
  }

  if (
    !OBSERVATION_METRICS.includes(
      lab.methodology.metric as (typeof OBSERVATION_METRICS)[number],
    )
  ) {
    throw new Error(
      `methodology.metric "${lab.methodology.metric}" must be one of: ${OBSERVATION_METRICS.join(', ')}`,
    );
  }
}
