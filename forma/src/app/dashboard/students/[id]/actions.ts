'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { isActivePro } from '@/lib/payments/planStatus';
import { generateParentReport } from '@/lib/ai/generateParentReport';
import { sendTutorParentReportEmail } from '@/lib/email/send';

const RECENT_SESSION_NOTES_LIMIT = 5;
const RECENT_SUBMISSIONS_LIMIT = 10;
const REPORT_PARAGRAPH_MAX_LENGTH = 2000;

// Security Rule 4: reject session notes over 5000 characters, server side.
const CONTENT_MAX_LENGTH = 5000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AddSessionNoteResult {
  error?: string;
  success?: boolean;
}

// Permissions Summary: session notes are a tutor-pro entitlement, same gate
// as the marking dashboard and mark scheme PDFs.
async function requireTutorPro(): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return { error: 'Session notes are available on the Tutor plan.' };
  }
  return { userId: user.id };
}

export async function addSessionNoteAction(
  _prevState: AddSessionNoteResult,
  formData: FormData
): Promise<AddSessionNoteResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }

  const studentId = String(formData.get('studentId') ?? '');
  const rawContent = String(formData.get('content') ?? '').trim();

  if (!UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid student.' };
  }
  if (!rawContent) {
    return { error: 'Please enter a note before saving.' };
  }
  if (rawContent.length > CONTENT_MAX_LENGTH) {
    return { error: `Session notes must be ${CONTENT_MAX_LENGTH} characters or fewer.` };
  }
  // Security Rule 7: strip HTML before this ever reaches the Claude API -
  // session notes flow into buildUserPrompt (Phase 6 Step 34), same as the
  // generation topic prompt already does at request time. Sanitizing here,
  // at write time, means the stored value is safe everywhere it's read
  // back (this page, and later the prompt), not just at one call site.
  const content = stripHtmlTags(rawContent).trim();
  if (!content) {
    return { error: 'Please enter a note before saving.' };
  }

  const supabase = await createClient();
  // RLS (notes_own: auth.uid() = tutor_id) enforces the tutor_id side of
  // ownership at the DB level. student_id isn't cross-checked against
  // student_profiles.owner_id here - same trust boundary the schedule
  // form's studentId already relies on elsewhere in this codebase, not a
  // new gap introduced by this action.
  const { error: insertError } = await supabase.from('session_notes').insert({
    tutor_id: auth.userId,
    student_id: studentId,
    content,
  });

  if (insertError) {
    console.error('Failed to save session note', insertError);
    return { error: 'Could not save this note - please try again.' };
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export interface GenerateParentReportResult {
  error?: string;
  paragraphs?: string[];
}

// Phase 5 Step 25: "AI-drafted, tutor approves before sending" - this only
// drafts and returns the paragraphs to the client for editing, it never
// sends anything itself. Permissions Summary lists "parent report drafts"
// as a Tutor-plan entitlement, same gate as session notes.
export async function generateParentReportAction(studentId: string): Promise<GenerateParentReportResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid student.' };
  }

  const supabase = await createClient();

  // RLS (profiles_own: auth.uid() = owner_id) means this returns nothing
  // for a student that isn't this tutor's own - same "doesn't exist" and
  // "isn't yours" collapse used everywhere else in this codebase.
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name, weaknesses')
    .eq('id', studentId)
    .single();
  if (!student) {
    return { error: 'Student not found.' };
  }

  const { data: noteRows } = await supabase
    .from('session_notes')
    .select('content')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(RECENT_SESSION_NOTES_LIMIT);

  const { data: submissionRows } = await supabase
    .from('submissions')
    .select('score_percentage, worksheet:worksheets(topic)')
    .eq('student_id', studentId)
    .not('score_percentage', 'is', null)
    .order('submitted_at', { ascending: false })
    .limit(RECENT_SUBMISSIONS_LIMIT)
    .returns<{ score_percentage: number | null; worksheet: { topic: string } | null }[]>();

  const recentSubmissions = (submissionRows ?? [])
    .filter((s): s is { score_percentage: number; worksheet: { topic: string } } => s.score_percentage !== null && s.worksheet !== null)
    .map((s) => ({ topic: s.worksheet.topic, scorePercentage: s.score_percentage }));

  try {
    const paragraphs = await generateParentReport({
      studentName: student.name,
      weaknesses: student.weaknesses,
      sessionNotes: (noteRows ?? []).map((n) => n.content),
      recentSubmissions,
    });
    return { paragraphs };
  } catch (error) {
    console.error('Failed to generate parent report', error);
    return { error: 'Could not generate a draft - please try again.' };
  }
}

export interface SendParentReportResult {
  error?: string;
  success?: boolean;
}

// Sends exactly what the tutor has in front of them after editing - never
// re-generates or alters wording server-side, matching
// TutorParentReportEmail's own "this template only lays it out, it does
// not generate or alter the wording" comment.
export async function sendParentReportAction(studentId: string, paragraphs: string[]): Promise<SendParentReportResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid student.' };
  }

  const cleanParagraphs = paragraphs
    .map((p) => stripHtmlTags(p).trim())
    .filter((p) => p.length > 0 && p.length <= REPORT_PARAGRAPH_MAX_LENGTH);
  if (cleanParagraphs.length === 0) {
    return { error: 'The report is empty - please write at least one paragraph.' };
  }

  const supabase = await createClient();
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name, parent_email')
    .eq('id', studentId)
    .single();
  if (!student) {
    return { error: 'Student not found.' };
  }
  if (!student.parent_email) {
    return { error: 'No parent email is set for this student - add one from the student list first.' };
  }

  const sent = await sendTutorParentReportEmail(student.parent_email, {
    studentName: student.name,
    reportParagraphs: cleanParagraphs,
  });
  if (!sent) {
    return { error: 'Could not send the report - please try again.' };
  }

  return { success: true };
}
