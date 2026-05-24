import * as fs from 'fs';
import * as path from 'path';
import { aggregateObservations, summaryToTsv } from './aggregate';
import { REPORT_SCHEMA } from './report';
import type { ClientId, LabDefinition, LabReport, Observation } from './types';

export class LabResultsService {
  constructor(private readonly definition: LabDefinition) {}

  writeRawObservation(observationsDir: string, observation: Observation): string {
    fs.mkdirSync(observationsDir, { recursive: true });
    const file = path.join(
      observationsDir,
      `${observation.profileId}__${observation.scenarioId}__${observation.clientId}__r${observation.runReplay}__${observation.sessionId.slice(0, 8)}.json`,
    );
    fs.writeFileSync(file, JSON.stringify(observation, null, 2), 'utf8');
    return file;
  }

  createReport(input: {
    sessionId: string;
    observations: Observation[];
    clientsUsed: ClientId[];
    generatedAt?: string;
  }): LabReport {
    return {
      schema: REPORT_SCHEMA,
      sessionId: input.sessionId,
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      cohort: this.definition.lab.cohort,
      methodology: this.definition.lab.methodology,
      clients: input.clientsUsed,
      observationCount: input.observations.length,
      summary: aggregateObservations(input.observations, this.definition.lab),
    };
  }

  writeReport(summaryDir: string, report: LabReport): void {
    fs.mkdirSync(summaryDir, { recursive: true });
    fs.writeFileSync(path.join(summaryDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(
      path.join(summaryDir, 'report.tsv'),
      summaryToTsv(report.summary, this.definition.lab.methodology.percentiles),
      'utf8',
    );
  }
}

export function createLabResultsService(definition: LabDefinition): LabResultsService {
  return new LabResultsService(definition);
}
