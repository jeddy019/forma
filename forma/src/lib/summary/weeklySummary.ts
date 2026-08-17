// Pure aggregation for EMAIL 4 (Monday parent summary) - extracted so the
// score/topic maths is unit-testable without a database, same discipline as
// src/lib/schedule/isDueNow.ts for the generation cron.
export interface ScoredSubmission {
  scorePercentage: number;
  topic: string;
}

export interface WeeklySummary {
  worksheetsCompleted: number;
  averageScorePercentage: number | null;
  strongestTopic: string | null;
  areaToImprove: string | null;
}

export function computeWeeklySummary(submissions: ScoredSubmission[]): WeeklySummary {
  if (submissions.length === 0) {
    return { worksheetsCompleted: 0, averageScorePercentage: null, strongestTopic: null, areaToImprove: null };
  }

  const total = submissions.reduce((sum, s) => sum + s.scorePercentage, 0);
  const averageScorePercentage = Math.round(total / submissions.length);

  // With exactly one submission, strongestTopic and areaToImprove end up
  // the same topic - correct, not a bug: a single data point is both the
  // best and worst result of the week.
  const sorted = [...submissions].sort((a, b) => b.scorePercentage - a.scorePercentage);

  return {
    worksheetsCompleted: submissions.length,
    averageScorePercentage,
    strongestTopic: sorted[0].topic,
    areaToImprove: sorted[sorted.length - 1].topic,
  };
}
