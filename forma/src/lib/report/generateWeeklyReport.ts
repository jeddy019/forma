import type { createAdminClient } from '@/lib/supabase/admin';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { renderWeeklyReportHtml } from '@/lib/pdf/report-template';
import { buildWeeklyReport, type ReportSubmission, type WeeklyReportData } from '@/lib/report/buildWeeklyReport';
import { resolveBranding, type Branding } from '@/lib/branding';

// Phase B W2 (weekly branded proof report): the one shared assembly used by
// BOTH the manual student-page send and the weekly cron - same data query,
// same PDF, so a founder who sends a student's report by hand mid-week gets
// exactly the document the cron would have produced on its own. Nothing is
// persisted here and no email is sent (callers own those concerns); this
// only returns the assembled data + the PDF buffer.

type AdminClient = ReturnType<typeof createAdminClient>;

export interface StudentReportRow {
  id: string;
  name: string;
  parent_email: string | null;
  report_note: string | null;
  owner_id: string;
}

interface ScoredSubmissionRow {
  score_percentage: number | null;
  submitted_at: string;
  worksheet: { topic: string } | null;
}

const DAYS_IN_WEEK = 7;

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

  // Scores only - no mark scheme, no raw answers; safe for a parent to
  // receive. Same student-scoped query the monday-summary cron uses.
  const { data: submissionRows } = await admin
    .from('submissions')
    .select('score_percentage, submitted_at, worksheet:worksheets(topic)')
    .eq('student_id', student.id)
    .gte('submitted_at', sinceIso)
    .not('score_percentage', 'is', null)
    .order('submitted_at', { ascending: false })
    .returns<ScoredSubmissionRow[]>();

  const submissions: ReportSubmission[] = (submissionRows ?? [])
    .filter(
      (s): s is ScoredSubmissionRow & { score_percentage: number; worksheet: { topic: string } } =>
        s.score_percentage !== null && s.worksheet !== null
    )
    .map((s) => ({ scorePercentage: s.score_percentage, topic: s.worksheet.topic, submittedAt: s.submitted_at }));

  const data = buildWeeklyReport(submissions, sinceIso, now);
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