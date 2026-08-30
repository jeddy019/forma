// Phase B W2 (weekly branded proof report): pure aggregation for the report
// PDF + email, mirroring src/lib/summary/weeklySummary.ts's "unit-testable
// without a database" discipline but for a fuller report - it adds the
// per-worksheet practice log and the period range label EMAIL 4's one-line
// digest never needed. The founder's note is NOT computed here - it is the
// founder's own words (report_note or a manual-send override), passed in at
// render time, never AI-drafted.
//
// W8 Wave C (report enrichment): the same discipline extends to the new
// proof sections - a 4-week score trend, sub-skill strengths/weaknesses from
// the student's skill_map, the week's topics and difficulty level, distinct
// days practised, and the attentiveness check. Each new computation stays a
// pure function of its inputs (defaulted to empty/omitted when absent), so
// the report never fabricates a number the data can't support.

import { computeWeeklySummary, type ScoredSubmission } from '@/lib/summary/weeklySummary';
import { toMasteryBars } from '@/lib/mastery/masteryView';
import type { SkillMap } from '@/lib/mastery/types';

export interface ReportSubmission extends ScoredSubmission {
  /** ISO timestamp, used only for the practice log ordering/labels. */
  submittedAt: string;
  /** Worksheet difficulty label ("foundation" | "standard" | "higher"), if any. */
  difficulty?: string | null;
}

export interface ReportActivityRow {
  dateLabel: string;
  topic: string;
  score: number;
}

export interface ReportSubSkillHighlights {
  /** Mastered / strong sub-skills (latest score >= 85), strongest first. */
  strengths: string[];
  /** Weak or below-threshold sub-skills, weakest first. */
  weaknesses: string[];
}

export interface ScoreTrendPoint {
  /** Start-of-week label for the bucket, e.g. "10 Aug". */
  label: string;
  averageScore: number | null;
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
  /** Distinct calendar days with a submitted practice, this week. */
  daysPractised: number;
  /** Distinct topics practised this week, most-recent-first. */
  topicsPractised: string[];
  /** Distinct difficulty levels practised this week, most-recent-first. */
  difficultyPractised: string[];
  /** Last 4 weeks' average scores, oldest first. Null = no data that week. */
  trend: ScoreTrendPoint[];
  /** Sub-skill highlights from the student's skill_map. */
  subSkills: ReportSubSkillHighlights;
  /**
   * Founder-set attentiveness check for the week: true = attentive,
   * false = needs monitoring, null = founder never marked it (omitted from
   * the PDF, never invented).
   */
  attentive: boolean | null;
}

export interface WeeklyReportOptions {
  skillMap?: SkillMap | null;
  /** Scored submissions from the last 28 days (including this week) for the trend. */
  trendSubmissions?: { scorePercentage: number; submittedAt: string }[];
  attentive?: boolean | null;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

// Fit 4 weekly averages into the report - the current week (sinceIso, which
// is `now - 7d`) plus the 3 weeks before it. Bucketing by fixed 7-day slices
// off sinceIso keeps the buckets aligned to the report's own "since - now"
// window no matter which weekday the cron fires. ISO strings compare
// lexicographically, so string bounds are safe.
export function buildScoreTrend(
  submissions: { scorePercentage: number; submittedAt: string }[],
  sinceIso: string,
  now: Date = new Date()
): ScoreTrendPoint[] {
  const day = 24 * 60 * 60 * 1000;
  const since = new Date(sinceIso).getTime();
  const starts = [since - 21 * day, since - 14 * day, since - 7 * day, since];
  const endIso = now.toISOString();

  return starts.map((start, index) => {
    const startIso = new Date(start).toISOString();
    const end = index === starts.length - 1 ? endIso : new Date(starts[index + 1]).toISOString();
    const bucket = submissions.filter((s) => s.submittedAt >= startIso && s.submittedAt < end);
    const average =
      bucket.length === 0
        ? null
        : Math.round(bucket.reduce((sum, s) => sum + s.scorePercentage, 0) / bucket.length);
    return { label: formatShortDate(new Date(start)), averageScore: average };
  });
}

// Phase 7 SkillMap -> the two "proof" lists a parent can act on. Reuses the
// same classify() as the mastery UI (mastered/strong = >= 85 recent, weak =
// needs-fundamentals flag) so the report never disagrees with the mastery
// bars the founder sees. Weakest first so the priority is obvious.
export function subSkillHighlights(skillMap: SkillMap | null | undefined, cap = 3): ReportSubSkillHighlights {
  const bars = toMasteryBars(skillMap);
  if (bars.length === 0) return { strengths: [], weaknesses: [] };

  const strengths = bars
    .filter((bar) => bar.level === 'mastered' || bar.level === 'strong')
    .slice(0, cap)
    .map((bar) => bar.subSkill);
  const weaknesses = bars
    .filter((bar) => bar.level === 'weak' || bar.level === 'progressing')
    .reverse()
    .slice(0, cap)
    .map((bar) => bar.subSkill);
  return { strengths, weaknesses };
}

export function buildWeeklyReport(
  submissions: ReportSubmission[],
  sinceIso: string,
  options: WeeklyReportOptions = {},
  now: Date = new Date()
): WeeklyReportData {
  const scored: ScoredSubmission[] = submissions.map((s) => ({ scorePercentage: s.scorePercentage, topic: s.topic }));
  const summary = computeWeeklySummary(scored);

  const activity = [...submissions]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .map((s) => ({ dateLabel: formatShortDate(new Date(s.submittedAt)), topic: s.topic, score: s.scorePercentage }));

  const daysPractised = new Set(submissions.map((s) => s.submittedAt.slice(0, 10))).size;
  const topicsPractised: string[] = [];
  for (const row of activity) {
    if (!topicsPractised.includes(row.topic)) topicsPractised.push(row.topic);
  }
  const difficultyPractised: string[] = [];
  for (const s of [...submissions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))) {
    if (s.difficulty && !difficultyPractised.includes(s.difficulty)) difficultyPractised.push(s.difficulty);
  }

  const periodLabel = `${formatShortDate(new Date(sinceIso))} - ${formatShortDate(now)} ${now.getFullYear()}`;

  return {
    ...summary,
    activity,
    periodLabel,
    daysPractised,
    topicsPractised,
    difficultyPractised,
    trend: buildScoreTrend(options.trendSubmissions ?? [], sinceIso, now),
    subSkills: subSkillHighlights(options.skillMap),
    attentive: options.attentive ?? null,
  };
}