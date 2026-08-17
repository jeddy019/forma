export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateWorksheet } from '@/lib/ai/generateWorksheet';
import { buildUserPrompt } from '@/lib/ai/buildUserPrompt';
import { splitMarkScheme } from '@/lib/ai/splitMarkScheme';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import { generateDigitalCode } from '@/lib/utils/digitalCode';
import { isActivePro } from '@/lib/payments/planStatus';
import { sendWorksheetReadyEmail } from '@/lib/email/send';
import type { Country } from '@/lib/constants';

const TOPIC_MAX_LENGTH = 1000;
const GENERATION_TIMEOUT_MS = 30_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_FAILURE_MESSAGE = 'Worksheet generation failed - please try again.';

interface GenerateRequestBody {
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

  const { data: ownerRow } = await supabase.from('users').select('email, plan, plan_expires_at, paper_size').eq('id', user.id).single();

  // Phase 5 Step 28: check_and_log_generation enforces the 3/month free
  // cap - it has no notion of plan at all, so an active paid plan must
  // skip it entirely, not just tolerate hitting the cap.
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
    .select('id, name, email, country, curriculum_level, year_level, subjects')
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

  const userPrompt = buildUserPrompt({
    studentName: student.name,
    country: student.country,
    curriculumLevel: student.curriculum_level,
    yearLevel: student.year_level,
    subjectHint: student.subjects ?? [],
    sessionNotes: latestNote?.content ?? 'none',
    topicPrompt: sanitizedTopic,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  let worksheet;
  try {
    worksheet = await generateWorksheet(userPrompt, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
    }
    console.error('Worksheet generation failed', error);
    return NextResponse.json({ error: GENERIC_FAILURE_MESSAGE }, { status: 500 });
  } finally {
    clearTimeout(timeout);
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

  // EMAIL 2 (Email Templates): "Worksheet ready - manual generation, sent
  // to student." Same student.email ?? owner.email fallback as the
  // scheduled cron's EMAIL 3 send - never fails the request itself (send()
  // already never throws; this is additionally fire-and-forget so a slow
  // or failed send can't hold up the response the tutor/parent is waiting
  // on for their own generation).
  const recipientEmail = student.email ?? ownerRow?.email;
  if (recipientEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    void sendWorksheetReadyEmail(recipientEmail, {
      studentName: student.name,
      subject: inserted.subject,
      topic: inserted.topic,
      worksheetUrl: `${appUrl}/s/${inserted.digital_code}`,
      sentToStudentDirectly: Boolean(student.email),
    }).catch((error) => console.error('Failed to send worksheet-ready email', error));
  }

  return NextResponse.json({ worksheet: inserted }, { status: 201 });
}
