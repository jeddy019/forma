'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdminEmail';
import { COUNTRIES, SUBJECTS, type Country, type Subject } from '@/lib/constants';
import { ANSWER_FORMATS, type AnswerFormat } from '@/lib/ai/schema';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TEXT_MAX_LENGTH = 2000;

export interface QuestionBankActionResult {
  error?: string;
  success?: boolean;
}

// Every action re-checks admin status itself server-side - never trust the
// page-level gate alone for a write, same "actions re-verify their own
// auth" discipline as requireTutorPro elsewhere in this codebase.
// question_bank's RLS is deny-all to anon/authenticated (schema.sql) - the
// admin/service-role client is the only one that can touch this table at
// all, by design, so every operation below uses it, with the real
// authorization check done in application code first.
async function requireAdmin(): Promise<{ error?: string; email?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    return { error: 'Not authorized.' };
  }
  return { email: user.email };
}

export async function createQuestionAction(
  _prevState: QuestionBankActionResult,
  formData: FormData
): Promise<QuestionBankActionResult> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const country = String(formData.get('country') ?? '');
  const curriculumLevel = String(formData.get('curriculumLevel') ?? '').trim();
  const subject = String(formData.get('subject') ?? '');
  const topic = String(formData.get('topic') ?? '').trim();
  const subSkill = String(formData.get('subSkill') ?? '').trim();
  const text = String(formData.get('text') ?? '').trim();
  const marksRaw = String(formData.get('marks') ?? '');
  const answerFormat = String(formData.get('answerFormat') ?? '');
  const answer = String(formData.get('answer') ?? '').trim();
  const m1 = String(formData.get('m1') ?? '').trim();
  const a1 = String(formData.get('a1') ?? '').trim();
  const commonError = String(formData.get('commonError') ?? '').trim();
  const allow = String(formData.get('allow') ?? '').trim();

  if (!COUNTRIES.includes(country as Country)) return { error: 'Please select a valid country.' };
  if (!curriculumLevel) return { error: 'Curriculum level is required.' };
  if (!SUBJECTS.includes(subject as Subject)) return { error: 'Please select a valid subject.' };
  if (!topic) return { error: 'Topic is required.' };
  if (!text || text.length > TEXT_MAX_LENGTH) return { error: `Question text is required and must be ${TEXT_MAX_LENGTH} characters or fewer.` };
  const marks = Number(marksRaw);
  if (!Number.isInteger(marks) || marks < 1 || marks > 20) return { error: 'Marks must be a whole number between 1 and 20.' };
  if (!ANSWER_FORMATS.includes(answerFormat as AnswerFormat)) {
    return { error: 'Please select a valid answer format.' };
  }
  if (!answer) return { error: 'Answer is required.' };
  if (!m1 || !a1) return { error: 'M1 and A1 mark scheme text are required.' };

  const admin = createAdminClient();
  const { error: insertError } = await admin.from('question_bank').insert({
    country,
    curriculum_level: curriculumLevel,
    subject,
    topic,
    sub_skill: subSkill || null,
    question_json: {
      text,
      marks,
      answer_format: answerFormat,
      answer,
      mark_scheme: { M1: m1, A1: a1, common_error: commonError || null, allow: allow || null },
    },
  });

  if (insertError) {
    console.error('Failed to save question bank entry', insertError);
    return { error: 'Could not save this question - please try again.' };
  }

  revalidatePath('/admin/question-bank');
  return { success: true };
}

export async function verifyQuestionAction(formData: FormData): Promise<void> {
  const auth = await requireAdmin();
  if (auth.error || !auth.email) return;

  const id = String(formData.get('id') ?? '');
  if (!UUID_PATTERN.test(id)) return;

  const admin = createAdminClient();
  await admin.from('question_bank').update({ verified_by: auth.email, verified_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/admin/question-bank');
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  const auth = await requireAdmin();
  if (auth.error) return;

  const id = String(formData.get('id') ?? '');
  if (!UUID_PATTERN.test(id)) return;

  const admin = createAdminClient();
  await admin.from('question_bank').delete().eq('id', id);
  revalidatePath('/admin/question-bank');
}
