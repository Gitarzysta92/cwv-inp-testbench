/** How profile × replicate runs are ordered in one cohort session. */
export type BenchSchedule = 'sequential' | 'interleave';

export type ExecutionStep = {
  profileId: string;
  replicate: number;
  stepIndex: number;
};
