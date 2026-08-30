'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { isActivePro } from '@/lib/payments/planStatus';
import { generateParentReport } from '@/lib/ai/generateParentReport';
import { sendTutorParentReportEmail, sendWeeklyReportEmail } from '@/lib/email/send';
import { resolveBranding } from '@/lib/branding';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateWeeklyReport, type StudentReportRow } from '@/lib/report/generateWeeklyReport';
import { resolveStudentFamilyEmails } from '@/lib/families/parentEmail';
import { generatePortalPassword, generatePortalUsername, hashPortalPassword } from '@/lib/portal/password';
import { PRACTICE_VOLUMES, DIFFICULTY_POSTURES, HOLIDAY_POSTURES, type PracticeVolume, type DifficultyPosture, type HolidayPosture } from '@/lib/daily/dailyDialPlan';

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
async function requireTutorPro(): Promise<{ error?: string; userId?: string; brand?: { name: string }; ownerBrand?: { brand_name: string | null; brand_accent: string | null } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { data: ownerRow } = await supabase
    .from('users')
    .select('role, plan, plan_expires_at, brand_name, brand_accent')
    .eq('id', user.id)
    .single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return { error: 'Session notes are available on the Tutor plan.' };
  }
  return {
    userId: user.id,
    brand: resolveBranding(ownerRow),
    ownerBrand: { brand_name: ownerRow.brand_name, brand_accent: ownerRow.brand_accent },
  };
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
    .select('id, name')
    .eq('id', studentId)
    .single();
  if (!student) {
    return { error: 'Student not found.' };
  }

  // W8 Wave E (family-first): a parent email lives on the FAMILY, not the
  // student row any more - resolve it here, same as the weekly report.
  const { emails: familyEmails } = await resolveStudentFamilyEmails(supabase, [student.id]);
  const parentEmail = familyEmails.get(student.id);
  if (!parentEmail) {
    return { error: 'No family email is set for this student - add one from the Families page first.' };
  }

  const sent = await sendTutorParentReportEmail(parentEmail, {
    studentName: student.name,
    reportParagraphs: cleanParagraphs,
    brandName: auth.brand?.name,
  });
  if (!sent) {
    return { error: 'Could not send the report - please try again.' };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Phase B W2 - weekly branded proof report
// ---------------------------------------------------------------------------

const REPORT_NOTE_MAX_LENGTH = 2000;

export interface SaveReportNoteResult {
  error?: string;
  success?: boolean;
}

// Saves the standing note and the attentiveness check together - both ride
// the same "this is what the founder set as their default" semantics, used
// by every AUTO-sent report (the weekly cron). The manual send can pass a
// fresher note/check at send time without persisting it - this action is
// only for saving/permanently updating the standing values. RLS
// (profiles_own: auth.uid() = owner_id) blocks saving to another tutor's
// student, so "not yours" and "gone" collapse together.
export async function saveReportNoteAction(
  studentId: string,
  note: string,
  attentive: boolean | null
): Promise<SaveReportNoteResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid student.' };
  }

  const clean = stripHtmlTags(note).trim();
  if (clean.length > REPORT_NOTE_MAX_LENGTH) {
    return { error: `The note must be ${REPORT_NOTE_MAX_LENGTH} characters or fewer.` };
  }

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('student_profiles')
    .update({ report_note: clean || null, report_attentive: attentive })
    .eq('id', studentId);
  if (updateError) {
    console.error('Failed to save report settings', updateError);
    return { error: 'Could not save these settings - please try again.' };
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}

export interface SendWeeklyReportResult {
  error?: string;
  success?: boolean;
}

// Sends this week's branded proof report to the student's family email as a
// PDF - the founder model's weekly deliverable. The note and attentiveness
// check passed here are whatever the founder has in front of them at send
// time; they are used for THIS send, each falling back to the standing saved
// value. Names are NEVER altered server-side (same principle as
// sendParentReportAction).
export async function sendWeeklyReportAction(studentId: string, note: string, attentive: boolean | null): Promise<SendWeeklyReportResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid student.' };
  }

  // Ownership check via RLS first (this returns nothing for someone else's
  // student), then the admin client is safe for the assembly queries.
  const supabase = await createClient();
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name, report_note, skill_map, report_attentive')
    .eq('id', studentId)
    .single<StudentReportRow>();
  if (!student) {
    return { error: 'Student not found.' };
  }

  // W8 Wave E (family-first): parent email lives on the FAMILY now - resolve
  // it here before building anything.
  const { emails: familyEmails } = await resolveStudentFamilyEmails(supabase, [student.id]);
  const parentEmail = familyEmails.get(student.id);
  if (!parentEmail) {
    return { error: 'This student is not in a family with an email - add one from the Families page first.' };
  }

  const typedNote = stripHtmlTags(note).trim();
  if (typedNote.length > REPORT_NOTE_MAX_LENGTH) {
    return { error: `The note must be ${REPORT_NOTE_MAX_LENGTH} characters or fewer.` };
  }
  const effectiveNote = typedNote || (student.report_note ?? '');
  const effectiveAttentive = attentive ?? student.report_attentive ?? null;

  try {
    const { data, pdfBuffer, filename } = await generateWeeklyReport(
      createAdminClient(),
      { ...student, report_note: effectiveNote, report_attentive: effectiveAttentive },
      auth.ownerBrand ?? { brand_name: null, brand_accent: null }
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const sent = await sendWeeklyReportEmail(
      parentEmail,
      {
        studentName: student.name,
        worksheetsCompleted: data.worksheetsCompleted,
        averageScorePercentage: data.averageScorePercentage,
        strongestTopic: data.strongestTopic,
        areaToImprove: data.areaToImprove,
        dashboardUrl: `${appUrl}/dashboard/students`,
        brandName: auth.brand?.name,
      },
      { filename, content: pdfBuffer }
    );

    if (!sent) {
      return { error: 'Could not send the report - please try again.' };
    }

    const { error: stampError } = await supabase.from('student_profiles').update({ last_report_sent_at: new Date().toISOString() }).eq('id', studentId);
    if (stampError) {
      console.error('Failed to stamp last_report_sent_at', stampError);
    }

    revalidatePath(`/dashboard/students/${studentId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send weekly report', error);
    return { error: 'Could not build the report - please try again.' };
  }
}

// --- Portal login provisioning (W8 Wave B slice 2) ---
//
// The ONLY paths that create or reset portal-account credentials. Handling a
// minor's login is founder-side by design (anti-swallow invariant): there is
// never a self-serve "forgot password" - the founder mints credentials at
// enrollment and mints new ones when they are lost. The plaintext password
// exists ONLY in the response of the action that just created it (shown once
// on screen); the database stores only the scrypt hash, so no later screen
// can ever show a password again - only Reset can mint another.

export interface PortalCredentialResult {
  error?: string;
  username?: string;
  password?: string;
}

async function requirePortalAccountOwner(studentId: string): Promise<{ error?: string; studentId?: string }> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) return { error: auth.error || 'You must be signed in.' };
  if (!UUID_PATTERN.test(studentId)) return { error: 'Invalid student.' };
  const supabase = await createClient();
  const { data: owned } = await supabase.from('student_profiles').select('id').eq('id', studentId).maybeSingle();
  if (!owned) return { error: 'Student not found.' };
  return { studentId };
}

export async function provisionPortalLoginAction(studentId: string): Promise<PortalCredentialResult> {
  const owner = await requirePortalAccountOwner(studentId);
  if (owner.error || !owner.studentId) return { error: owner.error };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('portal_accounts')
    .select('id')
    .eq('student_id', owner.studentId)
    .maybeSingle<{ id: string }>();
  if (existing) {
    return { error: 'This student already has a portal login. Use "Reset password" to issue a new one.' };
  }

  const { data: studentRow } = await admin.from('student_profiles').select('name').eq('id', owner.studentId).single<{ name: string }>();
  const username = generatePortalUsername(studentRow?.name ?? '');
  const password = generatePortalPassword();

  const { error } = await admin.from('portal_accounts').insert({
    kind: 'student',
    student_id: owner.studentId,
    username,
    password_hash: hashPortalPassword(password),
  });
  if (error) {
    console.error('Failed to provision portal login', error);
    return { error: 'Could not create the portal login - please try again.' };
  }

  revalidatePath(`/dashboard/students/${owner.studentId}`);
  return { username, password };
}

export async function resetPortalLoginAction(studentId: string): Promise<PortalCredentialResult> {
  const owner = await requirePortalAccountOwner(studentId);
  if (owner.error || !owner.studentId) return { error: owner.error };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('portal_accounts')
    .select('id, username')
    .eq('student_id', owner.studentId)
    .maybeSingle<{ id: string; username: string }>();
  if (!existing) {
    return { error: 'No portal login exists yet - issue one first.' };
  }

  const password = generatePortalPassword();
  const { error } = await admin
    .from('portal_accounts')
    .update({
      password_hash: hashPortalPassword(password),
      password_reset_at: new Date().toISOString(),
      failed_attempts: 0,
      locked_until: null,
    })
    .eq('id', existing.id);
  if (error) {
    console.error('Failed to reset portal password', error);
    return { error: 'Could not reset the password - please try again.' };
  }

  revalidatePath(`/dashboard/students/${owner.studentId}`);
  return { username: existing.username, password };
}

// --- Daily quiz dials (W8 Wave D) ---
//
// The founder-side per-student automation controls for the automatic daily
// quiz. Founder-only by design (PRODUCT EXPERIENCE MODEL: "Difficulty/volume
// dials are founder-side only; the portal only reflects what your tutor has
// set") - nothing here is ever offered to a student or parent. Values are
// validated against the same constant arrays the SQL CHECK constraints use,
// so an impossible value can never be stored.

export interface SaveDailyDialsResult {
  error?: string;
  success?: boolean;
}

export async function saveDailyDialsAction(
  studentId: string,
  practiceVolume: string,
  difficultyPosture: string,
  holidayPosture: string
): Promise<SaveDailyDialsResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }
  if (!UUID_PATTERN.test(studentId)) {
    return { error: 'Invalid student.' };
  }
  const volume = PRACTICE_VOLUMES.includes(practiceVolume as PracticeVolume) ? (practiceVolume as PracticeVolume) : null;
  const posture = DIFFICULTY_POSTURES.includes(difficultyPosture as DifficultyPosture)
    ? (difficultyPosture as DifficultyPosture)
    : null;
  const holiday = HOLIDAY_POSTURES.includes(holidayPosture as HolidayPosture) ? (holidayPosture as HolidayPosture) : null;
  if (!volume || !posture || !holiday) {
    return { error: 'Invalid daily settings.' };
  }

  const supabase = await createClient();
  // RLS (profiles_own: auth.uid() = owner_id) enforces ownership at the DB
  // level - a student from another account simply doesn't match here.
  const { error } = await supabase
    .from('student_profiles')
    .update({ practice_volume: volume, difficulty_posture: posture, holiday_posture: holiday })
    .eq('id', studentId);
  if (error) {
    console.error('Failed to save daily dials', error);
    return { error: 'Could not save the daily settings - please try again.' };
  }

  revalidatePath(`/dashboard/students/${studentId}`);
  return { success: true };
}
