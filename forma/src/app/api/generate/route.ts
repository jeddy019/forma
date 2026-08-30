export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWorksheet, buildWorksheetFromDeterministic } from '@/lib/ai/generateWorksheet';
import { buildUserPrompt } from '@/lib/ai/buildUserPrompt';
import { splitMarkScheme } from '@/lib/ai/splitMarkScheme';
import { resolveBranding } from '@/lib/branding';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { generateDigitalCode } from '@/lib/utils/digitalCode';
import { isActivePro } from '@/lib/payments/planStatus';
import { sendFamilyDailyReadyEmail } from '@/lib/email/send';
import { resolveStudentFamilyEmails } from '@/lib/families/parentEmail';
import { selectFundamentalsTarget } from '@/lib/mastery/selectFundamentalsTarget';
import { clearFundamentalsFlag } from '@/lib/mastery/clearFundamentalsFlag';
import { EXPECTED_TYPE_ORDER, DAILY_TYPE_ORDER } from '@/lib/ai/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { pullVerifiedQuestions } from '@/lib/questionBank/pullVerifiedQuestions';
import { blendWithBank } from '@/lib/questionBank/blendWithBank';
import { callMathEngine, matchMathEngineTopic } from '@/lib/ai/mathEngineClient';
import type { SkillMap } from '@/lib/mastery/types';
import type { Country } from '@/lib/constants';

const TOPIC_MAX_LENGTH = 1000;
// Raised from 30s to 55s with user sign-off, 2026-08-24: gpt-5.6-terra at
// reasoning_effort 'low' measured 31-34s on consecutive real generations
// (two 504 aborts live), against a documented 29.3s best case - the old cap
// turned model variance into failed generations. 55s fits inside this
// route's Vercel maxDuration of 60s with headroom for the DB write.
const GENERATION_TIMEOUT_MS = 55_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_FAILURE_MESSAGE = 'Worksheet generation failed - please try again.';

interface GenerateRequestBody {
  studentId?: string;
  topicPrompt?: string;
}

interface StudentProfileRow {
  id: string;
  name: string;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  skill_map: SkillMap | null;
  exam_board: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: GenerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { studentId, topicPrompt } = body;
  if (!studentId || !UUID_PATTERN.test(studentId)) {
    return NextResponse.json({ error: 'studentId is required.' }, { status: 400 });
  }
  if (!topicPrompt || typeof topicPrompt !== 'string' || topicPrompt.trim().length === 0) {
    return NextResponse.json({ error: 'topicPrompt is required.' }, { status: 400 });
  }
  if (topicPrompt.length > TOPIC_MAX_LENGTH) {
    return NextResponse.json({ error: `topicPrompt must be ${TOPIC_MAX_LENGTH} characters or fewer.` }, { status: 400 });
  }
  const sanitizedTopic = stripHtmlTags(topicPrompt).trim();

  const { data: ownerRow } = await supabase.from('users').select('email, plan, plan_expires_at, paper_size, brand_name, brand_accent').eq('id', user.id).single();

  // Phase 5 Step 28: check_and_log_generation enforces the 3/month free
  // cap - it has no notion of plan at all, so an active paid plan must
  // skip it entirely, not just tolerate hitting the cap.
  //
  // FOUNDER MODEL W6 (de-pro): isActivePro is unconditionally true, so this
  // branch and the RPC never fire - retained as the dormant free-tier shape
  // for the future SaaS sale, same discipline as planStatus.ts. Do not
  // delete the RPC from the DB; it is referenced here.
  if (!isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at)) {
    const { data: allowed, error: rpcError } = await supabase.rpc('check_and_log_generation', {
      p_user_id: user.id,
    });
    if (rpcError) {
      console.error('check_and_log_generation failed', rpcError);
      return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Free tier limit reached' }, { status: 403 });
    }
  }

  const { data: student, error: studentError } = await supabase
    .from('student_profiles')
    .select('id, name, country, curriculum_level, year_level, subjects, skill_map, exam_board')
    .eq('id', studentId)
    .single<StudentProfileRow>();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
  }

  // Phase 6 Step 34: same query the scheduled cron already used ahead of
  // its own UI existing (generate-scheduled/route.ts) - session notes are
  // a tutor-pro feature (Step 33's own gate), so a parent-owned or
  // free-tier student simply has none and this naturally falls through to
  // 'none' below, same as it always has.
  const { data: latestNote } = await supabase
    .from('session_notes')
    .select('content')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Phase 7 Step 41 (Return to fundamentals): AI-inferred on demand, no
  // curated prerequisite table - the model names the prerequisite itself
  // using its own curriculum knowledge, folded into the one generation call
  // that was happening anyway. Not personalized to group mode (excluded -
  // not one student) or the scheduled cron (deferred, same-shape follow-up).
  //
  // Routed through the same 5-question, single-sub-skill shape as Step 40's
  // daily mode rather than the standard 10-question worksheet - found live
  // during verification, not assumed: forcing gpt-4o to write a full
  // 2-warm-up/6-core/2-challenge worksheet confined to one narrow
  // prerequisite sub-skill measurably broke its question-count reliability
  // (5 of 6 test generations came back under 10 questions, vs. zero
  // failures observed anywhere else this session), while the identical
  // single-sub-skill instruction inside the already-5-question daily shape
  // was reliable every time it was tested. A focused 5-question set is also
  // a better pedagogical fit for "master the prerequisite first" than a
  // full tiered worksheet forces anyway.
  const fundamentalsTarget = selectFundamentalsTarget(student.skill_map ?? {});
  const subSkillDirective = fundamentalsTarget
    ? `The student is struggling with the sub-skill "${fundamentalsTarget.subSkill}" within "${fundamentalsTarget.topic}" (scored below 50% last time). Using your own curriculum knowledge, identify its single prerequisite sub-skill and write every question on that prerequisite instead - name the prerequisite in alignment_note.`
    : undefined;
  const typeOrder = fundamentalsTarget ? DAILY_TYPE_ORDER : EXPECTED_TYPE_ORDER;

  const userPrompt = buildUserPrompt({
    studentName: student.name,
    country: student.country,
    curriculumLevel: student.curriculum_level,
    yearLevel: student.year_level,
    subjectHint: student.subjects ?? [],
    sessionNotes: latestNote?.content ?? 'none',
    topicPrompt: sanitizedTopic,
    questionCount: fundamentalsTarget ? 5 : 10,
    subSkillDirective,
    examBoard: student.exam_board ?? undefined,
  });

  // --- Deterministic routing (Phase 10) ---
  // Check if the Python maths engine covers this topic. If so, generate
  // verified question data there and skip the AI entirely — faster, exact,
  // and costs zero tokens. On engine failure, fall through to the full AI
  // path so the user never sees an error from a working pipeline.
  let worksheet;
  const questionCount = fundamentalsTarget ? 5 : 10;

  const topicMatch = await matchMathEngineTopic(sanitizedTopic);
  if (topicMatch.is_deterministic && topicMatch.matched_keys.length > 0 && !fundamentalsTarget) {
    // Fundamentals routing targets a prerequisite sub-skill that may not
    // exist in the engine — skip deterministic for now to avoid partial
    // sets. The AI path handles this reliably.
    const engineResult = await callMathEngine({
      curriculum: student.curriculum_level,
      locale: student.country === 'canada_ontario' ? 'ontario' : student.country === 'united_states' ? 'us' : 'england',
      difficulty: student.curriculum_level.includes('A-Level') ? 'higher' : 'standard',
      year_level: student.year_level,
      topic: sanitizedTopic,
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
      console.log(`[deterministic] Routed ${sanitizedTopic} to maths engine (${topicMatch.matched_keys[0]}), ${questionCount} questions`);
    } else {
      console.log(`[deterministic] Engine returned ${engineResult?.questions?.length ?? 0}/${questionCount} questions, falling back to AI`);
    }
  }

  // --- AI fallback (existing path) ---
  if (!worksheet) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      worksheet = await generateWorksheet(userPrompt, controller.signal, typeOrder);
    } catch (error) {
      if (controller.signal.aborted) {
        return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
      }
      console.error('Worksheet generation failed', error);
      return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
    } finally {
      clearTimeout(timeout);
    }
  }

  // Phase 7 Step 42: pull verified question_bank rows for the AI's own
  // inferred subject (only known now, post-generation) and swap in any
  // matching-sub-skill question - see blendWithBank.ts for why this is
  // post-hoc. question_bank has deny-all RLS to anon/authenticated (see
  // admin/question-bank/actions.ts's own comment), so this must go through
  // the admin client, not the RLS'd `supabase` used everywhere else in this
  // route - best-effort, a bank lookup failure must not block generation.
  try {
    const admin = createAdminClient();
    const bankRows = await pullVerifiedQuestions(admin, student.country, student.curriculum_level, worksheet.subject, student.exam_board);
    worksheet = blendWithBank(worksheet, bankRows).worksheet;
  } catch (error) {
    console.error('Failed to blend question_bank rows', error);
  }

  const { questionsJson, markSchemeJson } = splitMarkScheme(worksheet);

  // digital_code is UNIQUE - a collision is rare (8 random bytes) but not
  // impossible, and without a retry it would burn the Claude API call and
  // the free-tier credit above for zero output. 23505 is Postgres' unique
  // violation code.
  const DIGITAL_CODE_UNIQUE_VIOLATION = '23505';
  const MAX_INSERT_ATTEMPTS = 3;

  let inserted = null;
  let insertError = null;
  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
    const result = await supabase
      .from('worksheets')
      .insert({
        owner_id: user.id,
        student_id: studentId,
        prompt_used: sanitizedTopic,
        questions_json: questionsJson,
        mark_scheme_json: markSchemeJson,
        alignment_note: worksheet.alignment_note,
        digital_code: generateDigitalCode(),
        subject: worksheet.subject,
        topic: worksheet.topic,
        difficulty: worksheet.difficulty_overall,
        paper_size: ownerRow?.paper_size ?? 'a4',
        generated_from: 'manual',
      })
      .select('id, digital_code, subject, topic, alignment_note, difficulty, created_at')
      .single();

    inserted = result.data;
    insertError = result.error;

    if (!insertError) break;
    if (insertError.code !== DIGITAL_CODE_UNIQUE_VIOLATION) break;
  }

  if (insertError || !inserted) {
    console.error('Failed to store worksheet', insertError);
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  // Only clear on a SUCCESSFUL insert (not a failed attempt above) - a
  // retry after a transient failure should still route to fundamentals.
  // Best-effort: a failure here must not fail the response for a worksheet
  // that was already successfully generated and stored.
  if (fundamentalsTarget) {
    try {
      await supabase
        .from('student_profiles')
        .update({ skill_map: clearFundamentalsFlag(student.skill_map ?? {}, fundamentalsTarget.subSkill) })
        .eq('id', studentId);
    } catch (error) {
      console.error('Failed to clear fundamentals flag', error);
    }
  }

  // W8 Wave E (family-first ready email, 2026-08-30): a manual worksheet's
  // ready notice goes to the student's FAMILY email (the only place a parent
  // email lives now), falling back to the owner when the student is not in a
  // family with an email yet - never fails the request itself (send() already
  // never throws; this is additionally fire-and-forget so a slow or failed
  // send can't hold up the response the tutor/parent is waiting on).
  const { emails } = await resolveStudentFamilyEmails(supabase, [student.id]);
  const recipientEmail = emails.get(student.id) ?? ownerRow?.email;
  if (recipientEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    void sendFamilyDailyReadyEmail(recipientEmail, {
      dateLabel: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      entries: [
        {
          name: student.name,
          subject: inserted.subject,
          topic: inserted.topic,
          url: `${appUrl}/s/${inserted.digital_code}`,
          digitalCode: inserted.digital_code,
        },
      ],
      brandName: resolveBranding(ownerRow).name,
    }).catch((error) => console.error('Failed to send worksheet-ready email', error));
  }

  return NextResponse.json({ worksheet: inserted }, { status: 201 });
}
