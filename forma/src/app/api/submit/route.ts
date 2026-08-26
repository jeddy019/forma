export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPart } from '@/lib/marking/tier1';
import { markExtendedPart, type Tier2Result } from '@/lib/marking/tier2';
import type { AnswerFormat } from '@/lib/ai/schema';
import { isActivePro } from '@/lib/payments/planStatus';
import { recordScore } from '@/lib/mastery/recordScore';
import type { SubSkillPartEntry } from '@/lib/mastery/accumulateBySubSkill';

// Submission handler (Phase 2 Step 13 built the minimal version alongside
// the /s/[code] page; Phase 3 Step 16 added Tier 1 auto-marking; Step 17
// adds Tier 2 AI-assisted marking here). auto_marks_json covers the
// auto-markable formats (numerical, coordinates, true_false,
// multiple_choice); ai_suggested_marks_json covers "extended" parts the
// student actually answered, via Tier 2 (claude-sonnet-4-6). Tier 2 is
// best-effort and never blocks the submission itself - a failed or timed-
// out call just leaves that part's entry null, same as an unanswered
// extended part, meaning "needs Tier 3 (tutor) review" once that queue
// exists.
//
// score_percentage: when the worksheet's owner has a marking dashboard to
// review it in (role === 'tutor' && isActivePro, the exact same gate as
// /dashboard/marking itself), this stays NULL here and is only ever set by
// that tutor's own review (marking/[id]/actions.ts) - a low-confidence AI
// suggestion must never be auto-applied (Marking Logic section), so no
// aggregate score can be computed until a human resolves those.
// Otherwise (Parent plan, or any free-tier account) there is no marking
// dashboard and never will be one for this submission - RLS scopes
// /dashboard/marking to the authenticated tutor's own worksheets, so a
// parent-owned submission can never appear in anyone's review queue. Found
// live in a 2026-08-19 audit: leaving score_percentage NULL forever in that
// case silently blanked the parent's own score display and starved the
// Monday summary email of any data every single week. Fixed by finalizing
// the score immediately below, from Tier 1 (exact-match, always safe to
// trust) plus Tier 2 results that are not low-confidence (the same
// "never auto-apply low confidence" rule, just applied automatically
// instead of by a human, since there is no human in this path) - never
// from a guess.
const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const ANSWER_MAX_LENGTH = 2000;
const MAX_PARTS_PER_QUESTION = 20; // generous upper bound, just to reject abuse payloads
const TIER2_TIMEOUT_MS = 15_000; // Performance Rule 10: Marking AI, 15 seconds maximum

interface SubmitRequestBody {
  digitalCode?: string;
  answers?: Record<string, unknown>;
}

// questions_json (student-safe, per Security Rules 1) only carries
// part_label/text/marks/diagram_spec/working_lines - answer, answer_format,
// and mark_scheme all live in mark_scheme_json instead (see splitMarkScheme.ts).
// Marking needs fields from both, merged by question/part index below - both
// arrays come from the same generation call in the same order, so index
// alignment is safe.
interface QuestionsJsonPart {
  text: string;
  marks: number;
}

interface QuestionsJsonQuestion {
  id: string;
  // Phase 7 Step 37/38: which component sub-skill this question targets,
  // read from questions_json (not mark_scheme_json - splitMarkScheme.ts
  // copies it into both, but this is simpler since sub_skill was never
  // answer-revealing) - used by the mastery-aggregation hook below.
  sub_skill: string;
  parts: QuestionsJsonPart[];
}

interface MarkSchemeJsonPart {
  answer: string;
  answer_format: AnswerFormat;
  M1: string;
  A1: string;
  common_error: string;
  allow: string;
}

interface MarkSchemeJsonQuestion {
  id: string;
  parts: MarkSchemeJsonPart[];
}

interface WorksheetRow {
  id: string;
  owner_id: string;
  student_id: string | null;
  expires_at: string | null;
  topic: string;
  questions_json: { questions: QuestionsJsonQuestion[] };
  mark_scheme_json: { questions: MarkSchemeJsonQuestion[] } | null;
}

export async function POST(request: NextRequest) {
  let body: SubmitRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { digitalCode, answers } = body;
  if (!digitalCode || !DIGITAL_CODE_PATTERN.test(digitalCode)) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 400 });
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return NextResponse.json({ error: 'answers is required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  // mark_scheme_json is only ever read here server-side with the service-role
  // client, and only used to build markPart()/markExtendedPart() input below -
  // it is never included in this route's response, so this does not violate
  // Security Rules 1 (that rule is about what a student's browser can read).
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('id, owner_id, student_id, expires_at, topic, questions_json, mark_scheme_json')
    .eq('digital_code', digitalCode)
    .single<WorksheetRow>();

  if (!worksheet) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }
  if (worksheet.expires_at !== null && new Date(worksheet.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 });
  }

  // Same gate as /dashboard/marking itself - if this owner can't reach a
  // marking dashboard for this submission, nobody ever will, so the score
  // has to finalize automatically below instead of waiting on a review that
  // can never happen. See the score_percentage comment above.
  const { data: ownerRow } = await admin.from('users').select('role, plan, plan_expires_at').eq('id', worksheet.owner_id).single();
  const hasTutorReview = ownerRow?.role === 'tutor' && isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at);

  const knownQuestionIds = new Set(worksheet.questions_json.questions.map((q) => q.id));
  const sanitizedAnswers: Record<string, string[]> = {};
  for (const [questionId, value] of Object.entries(answers)) {
    if (!knownQuestionIds.has(questionId)) continue; // ignore ids that don't belong to this worksheet
    if (!Array.isArray(value)) {
      return NextResponse.json({ error: 'answers is malformed.' }, { status: 400 });
    }
    if (value.length > MAX_PARTS_PER_QUESTION || !value.every((a) => typeof a === 'string' && a.length <= ANSWER_MAX_LENGTH)) {
      return NextResponse.json({ error: 'answers is malformed.' }, { status: 400 });
    }
    sanitizedAnswers[questionId] = value;
  }

  const markSchemeByQuestionId = new Map(
    (worksheet.mark_scheme_json?.questions ?? []).map((q) => [q.id, q.parts] as const)
  );

  const autoMarksJson: Record<string, ReturnType<typeof markPart>[]> = {};
  const aiSuggestedMarksJson: Record<string, (Tier2Result | null)[]> = {};
  const tier2Jobs: { questionId: string; partIndex: number; promise: Promise<Tier2Result> }[] = [];
  const tier2Controller = new AbortController();
  const tier2Timeout = setTimeout(() => tier2Controller.abort(), TIER2_TIMEOUT_MS);

  for (const question of worksheet.questions_json.questions) {
    const studentParts = sanitizedAnswers[question.id];
    if (!studentParts) continue;

    const markSchemeParts = markSchemeByQuestionId.get(question.id);
    if (!markSchemeParts) continue; // worksheet has no mark scheme - nothing to mark against

    autoMarksJson[question.id] = question.parts.map((part, i) => {
      const markSchemePart = markSchemeParts[i];
      if (!markSchemePart) return null;
      return markPart(markSchemePart.answer_format, markSchemePart.answer, studentParts[i] ?? '', part.marks);
    });

    aiSuggestedMarksJson[question.id] = question.parts.map(() => null);
    question.parts.forEach((part, i) => {
      const markSchemePart = markSchemeParts[i];
      if (!markSchemePart || markSchemePart.answer_format !== 'extended') return;
      const studentAnswer = studentParts[i];
      if (!studentAnswer || studentAnswer.trim() === '') return; // nothing to mark
      tier2Jobs.push({
        questionId: question.id,
        partIndex: i,
        promise: markExtendedPart(
          {
            questionText: part.text,
            marks: part.marks,
            markScheme: {
              M1: markSchemePart.M1,
              A1: markSchemePart.A1,
              common_error: markSchemePart.common_error,
              allow: markSchemePart.allow,
            },
            studentAnswer,
          },
          tier2Controller.signal
        ),
      });
    });
  }

  if (tier2Jobs.length > 0) {
    const results = await Promise.allSettled(tier2Jobs.map((job) => job.promise));
    results.forEach((result, i) => {
      const job = tier2Jobs[i];
      if (result.status === 'fulfilled') {
        aiSuggestedMarksJson[job.questionId][job.partIndex] = result.value;
      } else {
        console.error('Tier 2 marking failed', job.questionId, job.partIndex, result.reason);
      }
    });
  }
  clearTimeout(tier2Timeout);

  // Auto-finalize the score when there is no tutor who could ever review
  // this submission - see the score_percentage comment at the top of this
  // file. Mirrors marking/[id]/actions.ts's own totalAwarded/totalAvailable
  // loop (every part on the worksheet counts toward totalAvailable, an
  // unanswered or unresolved part awards 0), except the "what counts as
  // resolved" source is automatic here: Tier 1 first, then a Tier 2 result
  // that isn't low-confidence. Nothing is ever guessed.
  let scorePercentage: number | null = null;
  const subSkillParts: SubSkillPartEntry[] = [];
  if (!hasTutorReview) {
    let totalAwarded = 0;
    let totalAvailable = 0;
    for (const question of worksheet.questions_json.questions) {
      const tier1Parts = autoMarksJson[question.id];
      const tier2Parts = aiSuggestedMarksJson[question.id];
      question.parts.forEach((part, i) => {
        totalAvailable += part.marks;
        const tier1 = tier1Parts?.[i];
        if (tier1) {
          totalAwarded += tier1.marks_awarded;
          subSkillParts.push({ subSkill: question.sub_skill, marksAwarded: tier1.marks_awarded, marksAvailable: part.marks });
          return;
        }
        const tier2 = tier2Parts?.[i];
        if (tier2 && !tier2.needs_review) {
          totalAwarded += tier2.marks_awarded;
          subSkillParts.push({ subSkill: question.sub_skill, marksAwarded: tier2.marks_awarded, marksAvailable: part.marks });
          return;
        }
        // Unanswered, or an extended part Tier 2 flagged for human review
        // with nobody to review it - awards 0, same as the tutor path's own
        // default until someone can actually look at it.
        subSkillParts.push({ subSkill: question.sub_skill, marksAwarded: 0, marksAvailable: part.marks });
      });
    }
    scorePercentage = totalAvailable > 0 ? Math.round((totalAwarded / totalAvailable) * 100) : null;
  }

  const { error: insertError } = await admin.from('submissions').insert({
    worksheet_id: worksheet.id,
    student_id: worksheet.student_id,
    answers_json: sanitizedAnswers,
    auto_marks_json: autoMarksJson,
    ai_suggested_marks_json: aiSuggestedMarksJson,
    score_percentage: scorePercentage,
  });

  if (insertError) {
    console.error('Failed to store submission', insertError);
    return NextResponse.json({ error: 'Could not submit your answers - please try again.' }, { status: 500 });
  }

  // Adaptive Difficulty + Phase 7 Step 38 (skill_map): the tutor path runs
  // this from inside saveMarkingAction once a human finalizes a score; this
  // is that same logic (recordScore) for the auto-finalized path above,
  // since a Parent-plan or free-tier student would otherwise never get it
  // at all. Best-effort and awaited (not fire-and-forget) - see
  // StudentWorksheetPage's own note on why: an un-awaited update can lose
  // its promise when the serverless function tears down after the response
  // is sent. A failure here must not fail the submission that was just
  // successfully saved above.
  if (scorePercentage !== null && worksheet.student_id) {
    try {
      await recordScore(admin, worksheet.student_id, worksheet.id, worksheet.topic, scorePercentage, subSkillParts);
    } catch (error) {
      console.error('Failed to record score for adaptive difficulty / skill_map', error);
    }
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
