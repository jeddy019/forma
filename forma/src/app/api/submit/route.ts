import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPart } from '@/lib/marking/tier1';
import type { AnswerFormat } from '@/lib/ai/schema';

// Submission handler (Phase 2 Step 13 built the minimal version alongside
// the /s/[code] page; Phase 3 Step 16 adds Tier 1 auto-marking here).
// Still deliberately narrow: only the parts whose answer_format is
// auto-markable (numerical, coordinates, true_false, multiple_choice) get a
// result in auto_marks_json. "extended" parts get a null entry, meaning
// "not yet marked" - Tier 2 (AI-assisted) and Tier 3 (tutor review) don't
// exist yet, so score_percentage is deliberately left NULL rather than
// computed from a partial (auto-markable-only) subset of the marks, which
// would misrepresent the student's real score.
const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const ANSWER_MAX_LENGTH = 2000;
const MAX_PARTS_PER_QUESTION = 20; // generous upper bound, just to reject abuse payloads

interface SubmitRequestBody {
  digitalCode?: string;
  answers?: Record<string, unknown>;
}

interface WorksheetPart {
  answer: string;
  answer_format: AnswerFormat;
  marks: number;
}

interface WorksheetQuestion {
  id: string;
  parts: WorksheetPart[];
}

interface WorksheetRow {
  id: string;
  student_id: string | null;
  expires_at: string | null;
  questions_json: { questions: WorksheetQuestion[] };
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

  const autoMarksJson: Record<string, ReturnType<typeof markPart>[]> = {};
  for (const question of worksheet.questions_json.questions) {
    const studentParts = sanitizedAnswers[question.id];
    if (!studentParts) continue;
    autoMarksJson[question.id] = question.parts.map((part, i) =>
      markPart(part.answer_format, part.answer, studentParts[i] ?? '', part.marks)
    );
  }

  const { error: insertError } = await admin.from('submissions').insert({
    worksheet_id: worksheet.id,
    student_id: worksheet.student_id,
    answers_json: sanitizedAnswers,
    auto_marks_json: autoMarksJson,
  });

  if (insertError) {
    console.error('Failed to store submission', insertError);
    return NextResponse.json({ error: 'Could not submit your answers - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
