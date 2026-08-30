import type { createAdminClient } from '@/lib/supabase/admin';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { renderWeeklyReportHtml } from '@/lib/pdf/report-template';
import { buildWeeklyReport, type ReportSubmission, type WeeklyReportData } from '@/lib/report/buildWeeklyReport';
import { resolveBranding, type Branding } from '@/lib/branding';
import type { SkillMap } from '@/lib/mastery/types';

// Phase B W2 (weekly branded proof report): the one shared assembly used by
// BOTH the manual student-page send and the weekly cron - same data query,
// same PDF, so a founder who sends a student's report by hand mid-week gets
// exactly the document the cron would have produced on its own. Nothing is
// persisted here and no email is sent (callers own those concerns); this
// only returns the assembled data + the PDF buffer.
//
// W8 Wave C: the submissions query now spans 28 days (the 4-week score trend
// needs the three weeks before this one) and carries each worksheet's
// difficulty for the "Practised at" line. The student's skill_map feeds the
// sub-skill strengths/weaknesses; report_attentive feeds the attentiveness
// check - both founder-side, omitted from the document when never set.

type AdminClient = ReturnType<typeof createAdminClient>;

export interface StudentReportRow {
  id: string;
  name: string;
  report_note: string | null;
  skill_map: SkillMap | null;
  report_attentive: boolean | null;
  owner_id: string;
}

interface ScoredSubmissionRow {
  score_percentage: number | null;
  submitted_at: string;
  worksheet: { topic: string; difficulty: string | null } | null;
}

const DAYS_IN_WEEK = 7;
const TREND_SPAN_DAYS = 28;

function monthNameFromShorthand(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[date.getMonth()];
}

// Matches Performance Rule 11's filename philosophy ([FirstName]-[Subject]-
// [DDMMMYYYY]) - never a UUID or generic name for a document a parent files
// away.
export function reportFilename(studentName: string, now: Date): string {
  const firstName = studentName.trim().split(/\s+/)[0] || 'Student';
  const day = String(now.getDate()).padStart(2, '0');
  return `${firstName}-WeeklyReport-${day}${monthNameFromShorthand(now)}${now.getFullYear()}.pdf`;
}

export interface GenerateWeeklyReportResult {
  data: WeeklyReportData;
  pdfBuffer: Buffer;
  filename: string;
}

export async function generateWeeklyReport(
  admin: AdminClient,
  student: StudentReportRow,
  ownerRow: { brand_name: string | null; brand_accent: string | null },
  now: Date = new Date()
): Promise<GenerateWeeklyReportResult> {
  const sinceIso = new Date(now.getTime() - DAYS_IN_WEEK * 24 * 60 * 60 * 1000).toISOString();
  const sinceTrendIso = new Date(now.getTime() - TREND_SPAN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Scores only - no mark scheme, no raw answers; safe for a parent to
  // receive. Same student-scoped query the monday-summary cron uses, widened
  // to 28 days so the trend has three weeks of history behind this one.
  const { data: submissionRows } = await admin
    .from('submissions')
    .select('score_percentage, submitted_at, worksheet:worksheets(topic, difficulty)')
    .eq('student_id', student.id)
    .gte('submitted_at', sinceTrendIso)
    .not('score_percentage', 'is', null)
    .order('submitted_at', { ascending: false })
    .returns<ScoredSubmissionRow[]>();

  const parsed: ReportSubmission[] = (submissionRows ?? [])
    .filter(
      (s): s is ScoredSubmissionRow & { score_percentage: number; worksheet: { topic: string; difficulty: string | null } } =>
        s.score_percentage !== null && s.worksheet !== null
    )
    .map((s) => ({
      scorePercentage: s.score_percentage,
      topic: s.worksheet.topic,
      submittedAt: s.submitted_at,
      difficulty: s.worksheet.difficulty,
    }));

  const weekSubmissions = parsed.filter((s) => s.submittedAt >= sinceIso);
  const data = buildWeeklyReport(weekSubmissions, sinceIso, { skillMap: student.skill_map, trendSubmissions: parsed, attentive: student.report_attentive }, now);
  const brand: Branding = resolveBranding(ownerRow);
  const { html, footerTemplate } = renderWeeklyReportHtml({
    studentName: student.name,
    tutorNote: student.report_note ?? '',
    report: data,
    brand,
  });

  const pdfBuffer = await generatePdf(html, 'A4', { footerTemplate });
  return { data, pdfBuffer, filename: reportFilename(student.name, now) };
}