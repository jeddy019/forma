'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isActivePro } from '@/lib/payments/planStatus';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { SUBJECTS, DIFFICULTY_LEVELS, type Subject, type DifficultyLevel } from '@/lib/constants';

const NAME_MAX_LENGTH = 100;
// Matches /api/generate's own TOPIC_MAX_LENGTH - a template's notes field
// is applied straight into the topic prompt textbox (GenerateForm), so it
// has to fit the same server-side limit that route enforces.
const NOTES_MAX_LENGTH = 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TemplateActionResult {
  error?: string;
  success?: boolean;
}

// Permissions Summary: templates are a tutor-pro entitlement, same gate as
// session notes, the marking dashboard, mark scheme PDFs, and group mode.
async function requireTutorPro(): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return { error: 'Templates are available on the Tutor plan.' };
  }
  return { userId: user.id };
}

export async function createTemplateAction(_prevState: TemplateActionResult, formData: FormData): Promise<TemplateActionResult> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) {
    return { error: auth.error };
  }

  const name = String(formData.get('name') ?? '').trim();
  const subjectRaw = String(formData.get('subject') ?? '').trim();
  const difficultyRaw = String(formData.get('difficulty') ?? '').trim();
  const rawNotes = String(formData.get('notes') ?? '').trim();

  if (!name) {
    return { error: 'Template name is required.' };
  }
  if (name.length > NAME_MAX_LENGTH) {
    return { error: `Template name must be ${NAME_MAX_LENGTH} characters or fewer.` };
  }
  const subject = subjectRaw && (SUBJECTS as readonly string[]).includes(subjectRaw) ? (subjectRaw as Subject) : null;
  const difficulty = difficultyRaw && (DIFFICULTY_LEVELS as readonly string[]).includes(difficultyRaw) ? (difficultyRaw as DifficultyLevel) : null;

  if (rawNotes.length > NOTES_MAX_LENGTH) {
    return { error: `Notes must be ${NOTES_MAX_LENGTH} characters or fewer.` };
  }
  // Security Rule 7: stripped at write time (same reasoning as session
  // notes) since this becomes a topic prompt fed straight into the Claude
  // API when a tutor applies this template on the generate page.
  const notes = stripHtmlTags(rawNotes).trim();

  const supabase = await createClient();
  // question_count and has_diagrams are left to their table defaults (10,
  // true) - deliberately not exposed on the create form, since neither
  // one is actually wired into the generation pipeline yet (the AI system
  // prompt's question structure is fixed/verbatim per CLAUDE.md, not
  // parameterised) - the columns reserve the shape for when that changes,
  // same pattern as skill_map's own "no consumer yet" columns.
  const { error: insertError } = await supabase.from('templates').insert({
    tutor_id: auth.userId,
    name,
    subject,
    difficulty,
    notes: notes || null,
  });

  if (insertError) {
    console.error('Failed to save template', insertError);
    return { error: 'Could not save this template - please try again.' };
  }

  revalidatePath('/dashboard/templates');
  return { success: true };
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const auth = await requireTutorPro();
  if (auth.error || !auth.userId) return;

  const templateId = String(formData.get('templateId') ?? '');
  if (!UUID_PATTERN.test(templateId)) return;

  const supabase = await createClient();
  // RLS (templates_own: auth.uid() = tutor_id) is the real ownership
  // guard here, same as deleteScheduleAction's own delete.
  await supabase.from('templates').delete().eq('id', templateId);
  revalidatePath('/dashboard/templates');
}
