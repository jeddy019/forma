// Phase B Wave 5 (B74): Tutor analytics dashboard - pure derivation over
// worksheet/submission data so the overview and per-student pages share one
// set of maths and the numbers are unit-testable (same discipline as
// assignments/status.ts). No I/O, no components.
//
// A "completion" is a worksheet the student actually handed in - any
// submission row at all, submitted or reviewed. "Reviewed" additionally
// means a tutor has marked it (retained for a separate count).

export interface AnalyticsWorksheetRow {
  id: string;
  first_opened_at: string | null;
  subject: string | null;
  topic: string | null;
}

export interface AnalyticsSubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
  tutor_marks_json: unknown | null;
}

export interface CompletionStats {
  total: number;
  opened: number;
  submitted: number;
  reviewed: number;
  // 0..100, or null when nothing is submitted yet (avoid divide-by-zero).
  completionRate: number | null;
  // Mean percentage across submissions, or null with no scores.
  averageScore: number | null;
}

function toMinutes(ms: number): number {
  return ms / 60000;
}

export function computeCompletionStats(
  worksheets: AnalyticsWorksheetRow[],
  submissions: AnalyticsSubmissionRow[]
): CompletionStats {
  const total = worksheets.length;
  const opened = worksheets.filter((w) => w.first_opened_at).length;
  const submitted = submissions.length;
  const reviewed = submissions.filter((s) => s.tutor_marks_json !== null).length;
  const scored = submissions.filter((s) => s.score_percentage != null);
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + (s.score_percentage ?? 0), 0) / scored.length)
    : null;
  const completionRate = submitted && total ? Math.round((submitted / total) * 100) : null;
  return { total, opened, submitted, reviewed, completionRate, averageScore };
}

export interface TimeStats {
  // Mean minutes from first worksheet open to its submission, or null when
  // fewer than one pair exists (needs both timestamps).
  averageMinutes: number | null;
  // Slowest single student effort in minutes, or null.
  slowestMinutes: number | null;
  sampleSize: number;
}

export function computeTimeStats(
  worksheets: AnalyticsWorksheetRow[],
  submissions: AnalyticsSubmissionRow[]
): TimeStats {
  const byWorksheet = new Map(worksheets.map((w) => [w.id, w]));
  const durations: number[] = [];
  for (const submission of submissions) {
    const worksheet = byWorksheet.get(submission.worksheet_id);
    if (!worksheet?.first_opened_at) continue;
    const mins = toMinutes(
      new Date(submission.submitted_at).getTime() - new Date(worksheet.first_opened_at).getTime()
    );
    if (Number.isFinite(mins) && mins >= 0) durations.push(mins);
  }
  if (!durations.length) return { averageMinutes: null, slowestMinutes: null, sampleSize: 0 };
  const averageMinutes = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const slowestMinutes = Math.round(Math.max(...durations));
  return { averageMinutes, slowestMinutes, sampleSize: durations.length };
}

export interface TopicStat {
  subject: string | null;
  topic: string | null;
  total: number;
  submitted: number;
  // Mean percentage where submitted, else null.
  averageScore: number | null;
}

export function computeTopicStats(
  worksheets: AnalyticsWorksheetRow[],
  submissions: AnalyticsSubmissionRow[]
): TopicStat[] {
  const byWorksheet = new Map(worksheets.map((w) => [w.id, w]));
  const key = (w: AnalyticsWorksheetRow) => `${w.subject ?? ''}::${w.topic ?? ''}`;
  // Track which worksheet ids have been submitted per group, so one topic
  // spanning N worksheets aggregates (total = N) rather than an N-row split.
  const groups = new Map<string, { subject: string | null; topic: string | null; total: number; submittedIds: Set<string>; scores: number[] }>();

  for (const worksheet of worksheets) {
    const k = key(worksheet);
    const existing = groups.get(k);
    if (existing) {
      existing.total += 1;
    } else {
      groups.set(k, { subject: worksheet.subject, topic: worksheet.topic, total: 1, submittedIds: new Set(), scores: [] });
    }
  }
  for (const submission of submissions) {
    const worksheet = byWorksheet.get(submission.worksheet_id);
    if (!worksheet) continue;
    const group = groups.get(key(worksheet));
    if (!group) continue;
    group.submittedIds.add(worksheet.id);
    if (submission.score_percentage != null) group.scores.push(submission.score_percentage);
  }

  return Array.from(groups.values())
    .map((group) => ({
      subject: group.subject,
      topic: group.topic,
      total: group.total,
      submitted: group.submittedIds.size,
      averageScore: group.scores.length
        ? Math.round(group.scores.reduce((a, b) => a + b, 0) / group.scores.length)
        : null,
    }))
    .sort((a, b) => (a.subject ?? '').localeCompare(b.subject ?? '') || (a.topic ?? '').localeCompare(b.topic ?? ''));
}
