// Phase B Wave 1 (B10-B11): the shared quiz-generation pipeline, factored out
// of the tutor/parent /api/quiz/generate route so all three entry points can
// reuse it:
//   - tutor/parent  /api/quiz/generate      (authenticated owner)
//   - anonymous     /api/quiz/re-practice   (B10, resolves owner from the
//                                             worksheet's stored student)
//   - logged-in     /api/quiz/study         (B11 smart learning, verified-email
//                                             matched profile)
//
// The caller is responsible for the *auth* (who is asking) and for resolving
// who OWNS the worksheet (ownerId = the student's tutor/parent), since the
// student-facing routes can't rely on the tutor route's session-owner RLS.
// This core owns: limits (per-owner free tier), prompt building, deterministic
// maths routing, AI fallback, question-bank blending, schema split, storage,
// and the fire-and-forget email. It always uses the service-role client so the
// same code path works for every caller regardless of their session's RLS
// visibility.

import { createAdminClient } from '@/lib/supabase/admin';
import { buildUserPrompt } from '@/lib/ai/buildUserPrompt';
import { generateWorksheet, buildWorksheetFromDeterministic } from '@/lib/ai/generateWorksheet';
import { matchMathEngineTopic, callMathEngine } from '@/lib/ai/mathEngineClient';
import { pullVerifiedQuestions } from '@/lib/questionBank/pullVerifiedQuestions';
import { splitMarkScheme } from '@/lib/ai/splitMarkScheme';
import { resolveBranding } from '@/lib/branding';
import { generateDigitalCode } from '@/lib/utils/digitalCode';
import { blendWithBank } from '@/lib/questionBank/blendWithBank';
import { EXPECTED_TYPE_ORDER, DAILY_TYPE_ORDER, type QuestionType } from '@/lib/ai/schema';
import { isActivePro } from '@/lib/payments/planStatus';
import { sendFamilyDailyReadyEmail } from '@/lib/email/send';
import { resolveStudentFamilyEmails } from '@/lib/families/parentEmail';
import type { Country } from '@/lib/constants';

const GENERATION_TIMEOUT_MS = 55_000;
const GENERIC_FAILURE_MESSAGE = 'Quiz generation failed - please try again.';
const DIGITAL_CODE_UNIQUE_VIOLATION = '23505';
const MAX_INSERT_ATTEMPTS = 3;

export interface GenerateQuizProfile {
  id: string;
  name: string;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  exam_board: string | null;
}

export interface RePracticeTarget {
  subSkill: string;
  label: string;
}

export interface GenerateQuizOptions {
  profile: GenerateQuizProfile;
  // The worksheet owner (the student's tutor/parent), for ownership, limits
  // and the fallback email recipient.
  ownerId: string;
  owner: {
    email?: string | null;
    paper_size?: string | null;
    plan?: string | null;
    plan_expires_at?: string | null;
    brand_name?: string | null;
    brand_accent?: string | null;
  };
  // Exactly one targeting mode must be provided.
  topicPrompt?: string;
  focusSubSkills?: RePracticeTarget[];
  // W8 Wave D: a caller-provided sub-skill directive (used by the daily quiz
  // cron's weakest-sub-skill targeting) - mutually exclusive with
  // focusSubSkills, matching buildUserPrompt's own rule.
  subSkillDirective?: string;
  // Tutor-side "return to fundamentals" (mastery) routing - a focused 5-question
  // set on the identified prerequisite sub-skill. Mutually exclusive with
  // focusSubSkills and topicPrompt-driven foundations.
  fundamentalsTarget?: { subSkill: string; topic: string } | null;
  sessionNotes?: string;
  // W8 Wave D: overrides the length (else focus sets keeps 5, everything
  // else 10). The daily quiz derives its count from the volume dial.
  questionCount?: 5 | 10 | 15;
  // W8 Wave D: forces the "N core questions, no warm-up/challenge" prose
  // (passes buildUserPrompt's dailyStyle through).
  dailyStyle?: boolean;
  // W8 Wave D: the auto-daily cron skips the ready-email (the founder digest
  // covers delivery). Defaults to true for every existing caller.
  sendReadyEmail?: boolean;
  generatedFrom: 'quiz' | 're-practice' | 'study' | 'daily';
}

export interface GeneratedQuizRow {
  id: string;
  digital_code: string;
  subject: string;
  topic: string;
  alignment_note: string | null;
  difficulty: string | null;
  created_at: string;
  generated_from: string | null;
}

export async function generateQuiz(options: GenerateQuizOptions): Promise<GeneratedQuizRow> {
  const { profile, ownerId, owner } = options;
  const admin = createAdminClient();

  const isFocus = (options.focusSubSkills?.length ?? 0) > 0 || Boolean(options.fundamentalsTarget);
  const focusSubSkills = (options.focusSubSkills ?? []).map((s) => s.subSkill);
  // Daily sets override the length (volume dial decides; focus elsewhere
  // fixes it at the short 5).
  const questionCount = options.questionCount ?? (isFocus ? 5 : 10);
  // Daily quizzes are never warm-up or challenge - every question is a core
  // question (DAILY TYPE ORDER rule), padded to the dial's count. Focus sets
  // stay on the shared 5-core order.
  const typeOrder: QuestionType[] =
    options.generatedFrom === 'daily'
      ? (new Array(questionCount).fill('core') as QuestionType[])
      : isFocus
        ? DAILY_TYPE_ORDER
        : EXPECTED_TYPE_ORDER;

  // Per-owner free-tier check, mirroring the tutor route's atomic gate. The
  // RPC is SECURITY DEFINER so it runs as the table owner regardless of which
  // (possibly anonymous) client calls it.
  //
  // FOUNDER MODEL W6 (de-pro): isActivePro is unconditionally true, so this
  // branch and its check_and_log_generation RPC never fire - retained as the
  // dormant free-tier shape for the future SaaS sale, same discipline as
  // planStatus.ts. Do not delete the RPC from the DB; it is referenced here.
  if (!isActivePro(owner.plan, owner.plan_expires_at)) {
    const { data: allowed, error: rpcError } = await admin.rpc('check_and_log_generation', {
      p_user_id: ownerId,
    });
    if (rpcError) {
      console.error('check_and_log_generation failed', rpcError);
      throw new TrackedError(GENERIC_FAILURE_MESSAGE, 500);
    }
    if (!allowed) {
      throw new TrackedError('Free tier limit reached', 403);
    }
  }

  // Sub-skill directive text depends on which focused mode is active. A
  // caller-provided directive (the daily quiz's weakest-sub-skill targeting)
  // wins over the internal focus/fundamentals builders - callers must never
  // pass both.
  let subSkillDirective: string | undefined = options.subSkillDirective;
  if (!subSkillDirective) {
    if (options.fundamentalsTarget) {
      subSkillDirective = `The student is struggling with the sub-skill "${options.fundamentalsTarget.subSkill}" within "${options.fundamentalsTarget.topic}" (scored below 50% last time). Using your own curriculum knowledge, identify its single prerequisite sub-skill and write every question on that prerequisite instead - name the prerequisite in alignment_note.`;
    } else if (isFocus) {
      subSkillDirective = `The student is re-practising the specific sub-skills they struggled with. Using your own curriculum knowledge of these exact sub-skills, write questions that target them.`;
    }
  }

  const userPrompt = buildUserPrompt({
    studentName: profile.name,
    country: profile.country,
    curriculumLevel: profile.curriculum_level,
    yearLevel: profile.year_level,
    subjectHint: profile.subjects ?? [],
    sessionNotes: options.sessionNotes ?? 'none',
    topicPrompt: options.fundamentalsTarget
      ? options.fundamentalsTarget.topic
      : isFocus
        ? `Re-practise the following sub-skills: ${focusSubSkills.join(', ')}`
        : (options.topicPrompt ?? ''),
    questionCount,
    dailyStyle: options.dailyStyle,
    subSkillDirective,
    focusSubSkills: isFocus ? focusSubSkills : undefined,
    examBoard: profile.exam_board ?? undefined,
  });

  // --- Deterministic routing (only for free-topic prompts - a sub-skill focus
  // must stay with the AI so it can honour the exact sub-skill names). ---
  let worksheet;
  if (!isFocus) {
    const topicMatch = await matchMathEngineTopic(options.topicPrompt ?? '');
    if (topicMatch.is_deterministic && topicMatch.matched_keys.length > 0) {
      const engineResult = await callMathEngine({
        curriculum: profile.curriculum_level,
        locale: profile.country === 'canada_ontario' ? 'ontario' : profile.country === 'united_states' ? 'us' : 'england',
        difficulty: profile.curriculum_level.includes('A-Level') ? 'higher' : 'standard',
        year_level: profile.year_level,
        topic: options.topicPrompt ?? '',
        question_count: questionCount,
      });

      if (engineResult && engineResult.questions.length === questionCount) {
        worksheet = buildWorksheetFromDeterministic(engineResult.questions, {
          subject: engineResult.subject,
          topic: engineResult.topic,
          curriculum: engineResult.curriculum,
          year_level: engineResult.year_level,
          difficulty: engineResult.difficulty_overall,
          alignment_note: engineResult.alignment_note,
        });
        console.log(`[quiz:deterministic] Routed ${options.topicPrompt} to maths engine (${topicMatch.matched_keys[0]}), ${questionCount} questions`);
      } else {
        console.log(`[quiz:deterministic] Engine returned ${engineResult?.questions?.length ?? 0}/${questionCount} questions, falling back to AI`);
      }
    }
  }

  // --- AI fallback ---
  if (!worksheet) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      worksheet = await generateWorksheet(userPrompt, controller.signal, typeOrder);
    } catch (error) {
      if (controller.signal.aborted) {
        throw new TrackedError('This is taking longer than expected - please try again.', 504);
      }
      console.error('Quiz generation failed', error);
      throw new TrackedError(GENERIC_FAILURE_MESSAGE, 500);
    } finally {
      clearTimeout(timeout);
    }
  }

  // Question bank blending
  try {
    const bankRows = await pullVerifiedQuestions(admin, profile.country, profile.curriculum_level, worksheet.subject, profile.exam_board);
    worksheet = blendWithBank(worksheet, bankRows).worksheet;
  } catch (error) {
    console.error('Failed to blend question_bank rows', error);
  }

  const { questionsJson, markSchemeJson } = splitMarkScheme(worksheet);

  let inserted = null;
  let insertError = null;
  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
    const result = await admin
      .from('worksheets')
      .insert({
        owner_id: ownerId,
        student_id: profile.id,
        prompt_used: isFocus
          ? `Re-practise: ${focusSubSkills.join(', ')}`
          : (options.topicPrompt ?? ''),
        questions_json: questionsJson,
        mark_scheme_json: markSchemeJson,
        alignment_note: worksheet.alignment_note,
        digital_code: generateDigitalCode(),
        subject: worksheet.subject,
        topic: worksheet.topic,
        difficulty: worksheet.difficulty_overall,
        paper_size: owner.paper_size ?? 'a4',
        generated_from: options.generatedFrom,
      })
      .select('id, digital_code, subject, topic, alignment_note, difficulty, created_at, generated_from')
      .single<GeneratedQuizRow>();

    inserted = result.data;
    insertError = result.error;

    if (!insertError) break;
    if (insertError.code !== DIGITAL_CODE_UNIQUE_VIOLATION) break;
  }

  if (insertError || !inserted) {
    console.error('Failed to store quiz', insertError);
    throw new TrackedError(GENERIC_FAILURE_MESSAGE, 500);
  }

  // Fire-and-forget email (best-effort). Suppressed by the auto-daily cron -
  // its founder digest covers delivery and a per-student ready email would
  // duplicate it.
  if (options.sendReadyEmail !== false) {
    // W8 Wave E (family-first recipient, 2026-08-30): a parent email lives on
    // the FAMILY, never the student row, so resolve profile.id through its
    // family here - the single place generateQuiz decides where a ready
    // notice goes, whatever lower-level caller (manual quiz, study,
    // re-practice) triggered it. Falls back to the owner when the student has
    // no family email yet, mirroring the manual worksheet routes.
    const { emails, missing } = await resolveStudentFamilyEmails(admin, [profile.id]);
    const recipientEmail = emails.get(profile.id) ?? owner.email;
    if (recipientEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      if (missing > 0) {
        console.warn(`Quiz ready for ${profile.id}: no family email - fell back to owner (${owner.email ?? 'none'})`);
      }
      void sendFamilyDailyReadyEmail(recipientEmail, {
        dateLabel: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        entries: [
          {
            name: profile.name,
            subject: inserted.subject,
            topic: inserted.topic,
            url: `${appUrl}/q/${inserted.digital_code}`,
            digitalCode: inserted.digital_code,
          },
        ],
        brandName: resolveBranding(owner).name,
      }).catch((error) => console.error('Failed to send quiz-ready email', error));
    }
  }

  return inserted;
}

export class TrackedError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
