export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWorksheet, buildWorksheetFromDeterministic } from '@/lib/ai/generateWorksheet';
import { buildUserPrompt } from '@/lib/ai/buildUserPrompt';
import { splitMarkScheme } from '@/lib/ai/splitMarkScheme';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { generateDigitalCode } from '@/lib/utils/digitalCode';
import { isActivePro } from '@/lib/payments/planStatus';
import { sendWorksheetReadyEmail } from '@/lib/email/send';
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
const GENERATION_TIMEOUT_MS = 55_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_FAILURE_MESSAGE = 'Quiz generation failed - please try again.';

interface GenerateQuizRequestBody {
  studentId?: string;
  topicPrompt?: string;
}

interface StudentProfileRow {
  id: string;
  name: string;
  email: string | null;
  country: Country;
  curriculum_level: string;
  year_level: string;
  subjects: string[] | null;
  skill_map: SkillMap | null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: GenerateQuizRequestBody;
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

  const { data: ownerRow } = await supabase.from('users').select('email, plan, plan_expires_at, paper_size').eq('id', user.id).single();

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
    .select('id, name, email, country, curriculum_level, year_level, subjects, skill_map')
    .eq('id', studentId)
    .single<StudentProfileRow>();

  if (studentError || !student) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
  }

  const { data: latestNote } = await supabase
    .from('session_notes')
    .select('content')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
  });

  // --- Deterministic routing ---
  let worksheet;
  const questionCount = fundamentalsTarget ? 5 : 10;

  const topicMatch = await matchMathEngineTopic(sanitizedTopic);
  if (topicMatch.is_deterministic && topicMatch.matched_keys.length > 0 && !fundamentalsTarget) {
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
      console.log(`[quiz:deterministic] Routed ${sanitizedTopic} to maths engine (${topicMatch.matched_keys[0]}), ${questionCount} questions`);
    } else {
      console.log(`[quiz:deterministic] Engine returned ${engineResult?.questions?.length ?? 0}/${questionCount} questions, falling back to AI`);
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
        return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
      }
      console.error('Quiz generation failed', error);
      return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
    } finally {
      clearTimeout(timeout);
    }
  }

  // Question bank blending
  try {
    const admin = createAdminClient();
    const bankRows = await pullVerifiedQuestions(admin, student.country, student.curriculum_level, worksheet.subject);
    worksheet = blendWithBank(worksheet, bankRows).worksheet;
  } catch (error) {
    console.error('Failed to blend question_bank rows', error);
  }

  const { questionsJson, markSchemeJson } = splitMarkScheme(worksheet);

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
        generated_from: 'quiz',
      })
      .select('id, digital_code, subject, topic, alignment_note, difficulty, created_at, generated_from')
      .single();

    inserted = result.data;
    insertError = result.error;

    if (!insertError) break;
    if (insertError.code !== DIGITAL_CODE_UNIQUE_VIOLATION) break;
  }

  if (insertError || !inserted) {
    console.error('Failed to store quiz', insertError);
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

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

  // Fire-and-forget email
  const recipientEmail = student.email ?? ownerRow?.email;
  if (recipientEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    void sendWorksheetReadyEmail(recipientEmail, {
      studentName: student.name,
      subject: inserted.subject,
      topic: inserted.topic,
      worksheetUrl: `${appUrl}/q/${inserted.digital_code}`,
      sentToStudentDirectly: Boolean(student.email),
      portalUrl: `${appUrl}/student/login`,
    }).catch((error) => console.error('Failed to send quiz-ready email', error));
  }

  return NextResponse.json({ quiz: inserted }, { status: 201 });
}
