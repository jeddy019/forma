import type { createAdminClient } from '@/lib/supabase/admin';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { renderSessionBriefHtml } from '@/lib/pdf/session-brief-template';
import { buildWeeklyReport, type WeeklyReportData } from '@/lib/report/buildWeeklyReport';
import { sessionBriefWindow, type BriefWindow, type SessionBriefNote } from '@/lib/brief/buildSessionBrief';
import { resolveBranding, type Branding } from '@/lib/branding';

// Phase B W3 (session brief): the one shared assembly behind the founder's
// "Prep for next session" download. Anchor = the founder's most recent
// session note (fallback: last 7 days), then the SAME aggregation and the
// SAME branded-PDF pipeline as the weekly report - only the window and the
// verbatim last note are new. Nothing is persisted here and no email is sent
// (the caller just streams the PDF to the founder); this only returns the
// assembled data + the PDF buffer + what the brief actually covered, so the
// UI can surface the window without recomputing it.

type AdminClient = ReturnType<typeof createAdminClient>;

export interface SessionBriefStudentRow {
  id: string;
  name: string;
  curriculum_level: string | null;
  year_level: string | null;
}

interface ScoredSubmissionRow {
  score_percentage: number | null;
  submitted_at: string;
  worksheet: { topic: string } | null;
}

function monthNameFromShorthand(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[date.getMonth()];
}

// Matches Performance Rule 11's filename philosophy ([FirstName]-[Subject]-
// [DDMMMYYYY]) - a founder filing briefs away needs the same human-readable
// names a parent filing reports away does.
export function sessionBriefFilename(studentName: string, now: Date): string {
  const firstName = studentName.trim().split(/\s+/)[0] || 'Student';
  const day = String(now.getDate()).padStart(2, '0');
  return `${firstName}-SessionBrief-${day}${monthNameFromShorthand(now)}${now.getFullYear()}.pdf`;
}

export interface GenerateSessionBriefResult {
  data: WeeklyReportData;
  window: BriefWindow;
  lastNote: SessionBriefNote | null;
  pdfBuffer: Buffer;
  filename: string;
}

export async function generateSessionBrief(
  admin: AdminClient,
  student: SessionBriefStudentRow,
  ownerRow: { brand_name: string | null; brand_accent: string | null },
  now: Date = new Date()
): Promise<GenerateSessionBriefResult> {
  const { data: noteRows } = await admin
    .from('session_notes')
    .select('content, created_at')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<{ content: string; created_at: string }[]>();

  const lastNoteRow = noteRows?.[0] ?? null;
  const lastNote: SessionBriefNote | null = lastNoteRow
    ? { content: lastNoteRow.content, createdAt: lastNoteRow.created_at }
    : null;

  const window = sessionBriefWindow(lastNoteRow?.created_at ?? null, now);

  // Scores only - no mark scheme, no raw answers. Same student-scoped query
  // the weekly report and monday-summary use, just a different anchor.
  const { data: submissionRows } = await admin
    .from('submissions')
    .select('score_percentage, submitted_at, worksheet:worksheets(topic)')
    .eq('student_id', student.id)
    .gte('submitted_at', window.sinceIso)
    .not('score_percentage', 'is', null)
    .order('submitted_at', { ascending: false })
    .returns<ScoredSubmissionRow[]>();

  const submissions = (submissionRows ?? [])
    .filter(
      (s): s is ScoredSubmissionRow & { score_percentage: number; worksheet: { topic: string } } =>
        s.score_percentage !== null && s.worksheet !== null
    )
    .map((s) => ({ scorePercentage: s.score_percentage, topic: s.worksheet.topic, submittedAt: s.submitted_at }));

  const data = buildWeeklyReport(submissions, window.sinceIso, now);
  const brand: Branding = resolveBranding(ownerRow);
  const contextLine = student.curriculum_level && student.year_level
    ? `${student.curriculum_level} - ${student.year_level}`
    : null;

  const { html, footerTemplate } = renderSessionBriefHtml({
    studentName: student.name,
    contextLine,
    windowLabel: window.windowLabel,
    brief: data,
    lastNote,
    brand,
  });

  const pdfBuffer = await generatePdf(html, 'A4', { footerTemplate });
  return { data, window, lastNote, pdfBuffer, filename: sessionBriefFilename(student.name, now) };
}