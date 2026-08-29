// Phase B W2 (weekly branded proof report): pure aggregation for the report
// PDF + email, mirroring src/lib/summary/weeklySummary.ts's "unit-testable
// without a database" discipline but for a fuller report - it adds the
// per-worksheet practice log and the period range label EMAIL 4's one-line
// digest never needed. The founder's note is NOT computed here - it is the
// founder's own words (report_note or a manual-send override), passed in at
// render time, never AI-drafted.

import { computeWeeklySummary, type ScoredSubmission } from '@/lib/summary/weeklySummary';

export interface ReportSubmission extends ScoredSubmission {
  /** ISO timestamp, used only for the practice log ordering/labels. */
  submittedAt: string;
}

export interface ReportActivityRow {
  dateLabel: string;
  topic: string;
  score: number;
}

export interface WeeklyReportData {
  worksheetsCompleted: number;
  averageScorePercentage: number | null;
  strongestTopic: string | null;
  areaToImprove: string | null;
  /** Most-recent-first practice log, oldest weekly data first otherwise. */
  activity: ReportActivityRow[];
  /** Human period label, e.g. "29 August - 5 September 2026". */
  periodLabel: string;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

export function buildWeeklyReport(submissions: ReportSubmission[], sinceIso: string, now: Date = new Date()): WeeklyReportData {
  const scored: ScoredSubmission[] = submissions.map((s) => ({ scorePercentage: s.scorePercentage, topic: s.topic }));
  const summary = computeWeeklySummary(scored);

  const activity = [...submissions]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((s) => ({ dateLabel: formatShortDate(new Date(s.submittedAt)), topic: s.topic, score: s.scorePercentage }));

  const periodLabel =
    `${formatShortDate(new Date(sinceIso))} - ${formatShortDate(now)} ${now.getFullYear()}`;

  return { ...summary, activity, periodLabel };
}