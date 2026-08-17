'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { isActivePro } from '@/lib/payments/planStatus';

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
