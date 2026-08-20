'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isActivePro } from '@/lib/payments/planStatus';
import { recordScore } from '@/lib/mastery/recordScore';
import type { SubSkillPartEntry } from '@/lib/mastery/accumulateBySubSkill';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEEDBACK_MAX_LENGTH = 2000;

export interface SaveMarkingResult {
  error?: string;
  success?: boolean;
  // Adaptive Difficulty: "Show notice: 'Difficulty adjusted based on recent
  // performance.'" - set only when current_difficulty actually moved.
  difficultyNotice?: string;
}

interface Tier1PartResult {
  marks_awarded: number;
}

interface QuestionsJsonPart {
  marks: number;
}

interface QuestionsJsonQuestion {
  id: string;
  // Phase 7 Step 37/38: see api/submit/route.ts's identical field for why.
  sub_skill: string;
  parts: QuestionsJsonPart[];
}

interface SubmissionRow {
  id: string;
  student_id: string | null;
  answers_json: Record<string, string[]> | null;
  auto_marks_json: Record<string, (Tier1PartResult | null)[]> | null;
  worksheet: { id: string; questions_json: { questions: QuestionsJsonQuestion[] }; topic: string } | null;
}

// Tier 1 parts are objective exact-match results, not the tutor's to
// override here - only "extended" parts (the ones with no auto_marks_json
// entry) take a value from this form. See the Marking Logic section: the
// tutor "awards mark and optionally adds a comment" for exactly those.
export async function saveMarkingAction(
  _prevState: SaveMarkingResult,
  formData: FormData
): Promise<SaveMarkingResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be signed in to save marking.' };
  }

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return { error: 'The marking dashboard is available on the Tutor plan.' };
  }

  const submissionId = String(formData.get('submissionId') ?? '');
  if (!UUID_PATTERN.test(submissionId)) {
    return { error: 'Invalid submission.' };
  }

  const feedback = String(formData.get('feedback') ?? '').trim();
  if (feedback.length > FEEDBACK_MAX_LENGTH) {
    return { error: `Feedback must be ${FEEDBACK_MAX_LENGTH} characters or fewer.` };
  }

  // Re-fetch fresh from the DB rather than trusting anything about
  // auto_marks_json or the worksheet echoed back from the client - only the
  // tutor's own typed-in marks and feedback come from formData.
  const { data: submission } = await supabase
    .from('submissions')
    .select('id, student_id, answers_json, auto_marks_json, worksheet:worksheets(id, questions_json, topic)')
    .eq('id', submissionId)
    .single<SubmissionRow>();

  if (!submission || !submission.worksheet) {
    return { error: 'Submission not found.' };
  }

  const answers = submission.answers_json ?? {};
  const autoMarks = submission.auto_marks_json ?? {};

  const tutorMarksJson: Record<string, (number | null)[]> = {};
  let totalAwarded = 0;
  let totalAvailable = 0;
  const subSkillParts: SubSkillPartEntry[] = [];

  for (const question of submission.worksheet.questions_json.questions) {
    const answeredParts = answers[question.id];
    const tier1Parts = autoMarks[question.id];

    tutorMarksJson[question.id] = question.parts.map((part, i) => {
      totalAvailable += part.marks;

      const tier1 = tier1Parts?.[i];
      if (tier1) {
        totalAwarded += tier1.marks_awarded;
        subSkillParts.push({ subSkill: question.sub_skill, marksAwarded: tier1.marks_awarded, marksAvailable: part.marks });
        return null; // Tier 1 already marked this part - not the tutor's to set
      }

      const wasAnswered = (answeredParts?.[i] ?? '').trim() !== '';
      if (!wasAnswered) {
        subSkillParts.push({ subSkill: question.sub_skill, marksAwarded: 0, marksAvailable: part.marks });
        return 0; // nothing submitted for this part - no marks, nothing to award
      }

      const raw = formData.get(`mark:${question.id}:${i}`);
      const parsed = raw === null ? 0 : Math.round(Number(raw));
      const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(part.marks, parsed)) : 0;
      totalAwarded += clamped;
      subSkillParts.push({ subSkill: question.sub_skill, marksAwarded: clamped, marksAvailable: part.marks });
      return clamped;
    });
  }

  const scorePercentage = totalAvailable > 0 ? Math.round((totalAwarded / totalAvailable) * 100) : null;

  const { error: updateError } = await supabase
    .from('submissions')
    .update({
      tutor_marks_json: tutorMarksJson,
      tutor_feedback: feedback || null,
      score_percentage: scorePercentage,
    })
    .eq('id', submissionId);

  if (updateError) {
    console.error('Failed to save marking', updateError);
    return { error: 'Could not save marking - please try again.' };
  }

  // Adaptive Difficulty + Phase 7 Step 38 (skill_map): only runs once a real
  // score exists (totalAvailable could be 0 for a worksheet with no
  // markable parts, in which case scorePercentage is null and there's
  // nothing to adjust). A failure here must not undo the marking that was
  // just successfully saved above - it's a best-effort follow-on, not part
  // of the save's own success/failure.
  let difficultyNotice: string | undefined;
  if (scorePercentage !== null && submission.student_id) {
    try {
      const result = await recordScore(
        supabase,
        submission.student_id,
        submission.worksheet.id,
        submission.worksheet.topic,
        scorePercentage,
        subSkillParts
      );
      difficultyNotice = result.difficultyNotice;
    } catch (error) {
      console.error('Failed to record score for adaptive difficulty / skill_map', error);
    }
  }

  revalidatePath(`/dashboard/marking/${submissionId}`);
  revalidatePath('/dashboard/marking');
  return { success: true, difficultyNotice };
}
