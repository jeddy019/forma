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
import { callMathEngine, matchMathEngineTopic } from '@/lib/ai/mathEngineClient';
import type { Country } from '@/lib/constants';

// Phase 6 Step 31: Group mode - "one worksheet, multiple students." One
// Claude call generates one shared question set; each selected student
// still gets their own worksheets row (own digital_code, own PDF, own
// submission tracking) - group_id ties them together for the comparison
// view (Step 31's other half, at /dashboard/generate/group/[groupId]).
// Permissions Summary lists "group mode" only under TUTOR's paid plan, not
// PARENT's - the free-tier 3/month cap is therefore never relevant here
// (only an active-pro tutor ever reaches this route), unlike /api/generate.
const TOPIC_MAX_LENGTH = 1000;
const GENERATION_TIMEOUT_MS = 55_000; // same user-signed-off raise as the main generate route, 2026-08-24
const MIN_GROUP_SIZE = 2;
const MAX_GROUP_SIZE = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_FAILURE_MESSAGE = 'Worksheet generation failed - please try again.';

interface GenerateGroupRequestBody {
  studentIds?: string[];
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

  const { data: ownerRow } = await supabase.from('users').select('email, role, plan, plan_expires_at, paper_size').eq('id', user.id).single();
  if (ownerRow?.role !== 'tutor' || !isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at)) {
    return NextResponse.json({ error: 'Group mode is available on the Tutor plan.' }, { status: 403 });
  }

  let body: GenerateGroupRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { studentIds, topicPrompt } = body;
  if (!Array.isArray(studentIds) || studentIds.length < MIN_GROUP_SIZE || studentIds.length > MAX_GROUP_SIZE) {
    return NextResponse.json({ error: `Select between ${MIN_GROUP_SIZE} and ${MAX_GROUP_SIZE} students for group mode.` }, { status: 400 });
  }
  if (!studentIds.every((id) => typeof id === 'string' && UUID_PATTERN.test(id)) || new Set(studentIds).size !== studentIds.length) {
    return NextResponse.json({ error: 'Invalid student selection.' }, { status: 400 });
  }
  if (!topicPrompt || typeof topicPrompt !== 'string' || topicPrompt.trim().length === 0) {
    return NextResponse.json({ error: 'topicPrompt is required.' }, { status: 400 });
  }
  if (topicPrompt.length > TOPIC_MAX_LENGTH) {
    return NextResponse.json({ error: `topicPrompt must be ${TOPIC_MAX_LENGTH} characters or fewer.` }, { status: 400 });
  }
  const sanitizedTopic = stripHtmlTags(topicPrompt).trim();

  const { data: students, error: studentsError } = await supabase
    .from('student_profiles')
    .select('id, name, email, country, curriculum_level, year_level, subjects, exam_board')
    .in('id', studentIds)
    .returns<StudentProfileRow[]>();

  // RLS (profiles_own) already scopes this to the tutor's own students -
  // a count mismatch means at least one id was invalid or not theirs,
  // covering both cases without distinguishing them.
  if (studentsError || !students || students.length !== studentIds.length) {
    return NextResponse.json({ error: 'One or more selected students could not be found.' }, { status: 404 });
  }

  const first = students[0];
  const sameLevel = students.every(
    (s) => s.country === first.country && s.curriculum_level === first.curriculum_level && s.year_level === first.year_level
  );
  if (!sameLevel) {
    return NextResponse.json({ error: 'Group mode requires all selected students to be at the same curriculum level.' }, { status: 400 });
  }

  // Shared subject hint across the group (union, deduplicated) - no single
  // student's own name goes into the prompt (see studentName below), since
  // a group worksheet shouldn't read as personalised to one individual.
  const subjectHint = [...new Set(students.flatMap((s) => s.subjects ?? []))];

  const userPrompt = buildUserPrompt({
    studentName: 'the student',
    country: first.country,
    curriculumLevel: first.curriculum_level,
    yearLevel: first.year_level,
    subjectHint,
    // Session notes are per-student and this worksheet isn't - group mode
    // deliberately doesn't pull any one student's notes in, same reasoning
    // as not using any one student's name.
    sessionNotes: 'none',
    topicPrompt: sanitizedTopic,
    examBoard: first.exam_board ?? undefined,
  });

  // --- Deterministic routing (Phase 10) ---
  // Same pattern as /api/generate/route.ts but for group mode. The first
  // student's country determines the locale for the maths engine. Group mode
  // is tutor-only (always pro), so no free-tier check needed.
  let worksheet;
  const topicMatch = await matchMathEngineTopic(sanitizedTopic);
  if (topicMatch.is_deterministic && topicMatch.matched_keys.length > 0) {
    const engineResult = await callMathEngine({
      curriculum: first.curriculum_level,
      locale: first.country === 'canada_ontario' ? 'ontario' : first.country === 'united_states' ? 'us' : 'england',
      difficulty: first.curriculum_level.includes('A-Level') ? 'higher' : 'standard',
      year_level: first.year_level,
      topic: sanitizedTopic,
      question_count: 10,
    });

    if (engineResult && engineResult.questions.length === 10) {
      worksheet = buildWorksheetFromDeterministic(engineResult.questions, {
        subject: engineResult.subject,
        topic: engineResult.topic,
        curriculum: engineResult.curriculum,
        year_level: engineResult.year_level,
        difficulty: engineResult.difficulty_overall,
        alignment_note: engineResult.alignment_note,
      });
      console.log(`[deterministic] Routed group ${sanitizedTopic} to maths engine (${topicMatch.matched_keys[0]}), 10 questions`);
    } else {
      console.log(`[deterministic] Engine returned ${engineResult?.questions?.length ?? 0}/10 questions, falling back to AI`);
    }
  }

  // --- AI fallback (existing path) ---
  if (!worksheet) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      worksheet = await generateWorksheet(userPrompt, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
      }
      console.error('Group worksheet generation failed', error);
      return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
    } finally {
      clearTimeout(timeout);
    }
  }

  const { questionsJson, markSchemeJson } = splitMarkScheme(worksheet);
  const groupId = crypto.randomUUID();

  const DIGITAL_CODE_UNIQUE_VIOLATION = '23505';
  const MAX_INSERT_ATTEMPTS = 3;

  const inserted: { id: string; digital_code: string; student_id: string }[] = [];
  for (const student of students) {
    let row: { id: string; digital_code: string; student_id: string } | null = null;
    let insertError: { code?: string; message: string } | null = null;
    for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt++) {
      const result = await supabase
        .from('worksheets')
        .insert({
          owner_id: user.id,
          student_id: student.id,
          group_id: groupId,
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
        .select('id, digital_code, student_id')
        .single();

      row = result.data;
      insertError = result.error;
      if (!insertError) break;
      if (insertError.code !== DIGITAL_CODE_UNIQUE_VIOLATION) break;
    }

    if (insertError || !row) {
      // Partial-group failure: whatever already inserted for this group
      // stays (each row is independently valid and usable) - not rolled
      // back, since there's no multi-row transaction here and a partial
      // group is still more useful than discarding successful rows.
      console.error(`Failed to store group worksheet for student ${student.id}`, insertError);
      continue;
    }
    inserted.push(row);

    const recipientEmail = student.email ?? ownerRow?.email;
    if (recipientEmail) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      void sendWorksheetReadyEmail(recipientEmail, {
        studentName: student.name,
        subject: worksheet.subject,
        topic: worksheet.topic,
        worksheetUrl: `${appUrl}/s/${row.digital_code}`,
        sentToStudentDirectly: Boolean(student.email),
        portalUrl: `${appUrl}/student/login`,
      }).catch((error) => console.error('Failed to send worksheet-ready email', error));
    }
  }

  if (inserted.length === 0) {
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  }

  return NextResponse.json(
    { groupId, subject: worksheet.subject, topic: worksheet.topic, studentCount: inserted.length },
    { status: 201 }
  );
}
