import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Minimal submission handler, built alongside Phase 2 Step 13 (the /s/[code]
// page needs somewhere to submit to) rather than waiting for Phase 3 Step 15
// ("Submission handler"). Deliberately narrow: stores answers_json only.
// Tier 1/2/3 marking (auto-mark, AI-assisted, tutor review queue) stays
// Phase 3 Steps 16-19, untouched - score_percentage, auto_marks_json,
// ai_suggested_marks_json, and tutor_marks_json are all left NULL here.
const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const ANSWER_MAX_LENGTH = 2000;
const MAX_PARTS_PER_QUESTION = 20; // generous upper bound, just to reject abuse payloads

interface SubmitRequestBody {
  digitalCode?: string;
  answers?: Record<string, unknown>;
}

interface WorksheetRow {
  id: string;
  student_id: string | null;
  expires_at: string | null;
  questions_json: { questions: { id: string; parts: unknown[] }[] };
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
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('id, student_id, expires_at, questions_json')
    .eq('digital_code', digitalCode)
    .single<WorksheetRow>();

  if (!worksheet) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }
  if (worksheet.expires_at !== null && new Date(worksheet.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 });
  }

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

  const { error: insertError } = await admin.from('submissions').insert({
    worksheet_id: worksheet.id,
    student_id: worksheet.student_id,
    answers_json: sanitizedAnswers,
  });

  if (insertError) {
    console.error('Failed to store submission', insertError);
    return NextResponse.json({ error: 'Could not submit your answers - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
