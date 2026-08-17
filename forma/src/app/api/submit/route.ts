import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPart } from '@/lib/marking/tier1';
import { markExtendedPart, type Tier2Result } from '@/lib/marking/tier2';
import type { AnswerFormat } from '@/lib/ai/schema';

// Submission handler (Phase 2 Step 13 built the minimal version alongside
// the /s/[code] page; Phase 3 Step 16 added Tier 1 auto-marking; Step 17
// adds Tier 2 AI-assisted marking here). auto_marks_json covers the
// auto-markable formats (numerical, coordinates, true_false,
// multiple_choice); ai_suggested_marks_json covers "extended" parts the
// student actually answered, via Tier 2 (claude-sonnet-4-6). Tier 2 is
// best-effort and never blocks the submission itself - a failed or timed-
// out call just leaves that part's entry null, same as an unanswered
// extended part, meaning "needs Tier 3 (tutor) review" once that queue
// exists. score_percentage stays NULL regardless - see Step 16's note below,
// still true now that Tier 2 exists: a low-confidence AI suggestion must
// never be auto-applied (Marking Logic section), so no aggregate score can
// be computed until Tier 3 (tutor review) can resolve those.
const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const ANSWER_MAX_LENGTH = 2000;
const MAX_PARTS_PER_QUESTION = 20; // generous upper bound, just to reject abuse payloads
const TIER2_TIMEOUT_MS = 15_000; // Performance Rule 10: Marking AI, 15 seconds maximum

interface SubmitRequestBody {
  digitalCode?: string;
  answers?: Record<string, unknown>;
}

interface WorksheetPart {
  text: string;
  answer: string;
  answer_format: AnswerFormat;
  marks: number;
  mark_scheme: {
    M1: string;
    A1: string;
    common_error: string;
    allow: string;
  };
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
  const aiSuggestedMarksJson: Record<string, (Tier2Result | null)[]> = {};
  const tier2Jobs: { questionId: string; partIndex: number; promise: Promise<Tier2Result> }[] = [];
  const tier2Controller = new AbortController();
  const tier2Timeout = setTimeout(() => tier2Controller.abort(), TIER2_TIMEOUT_MS);

  for (const question of worksheet.questions_json.questions) {
    const studentParts = sanitizedAnswers[question.id];
    if (!studentParts) continue;

    autoMarksJson[question.id] = question.parts.map((part, i) =>
      markPart(part.answer_format, part.answer, studentParts[i] ?? '', part.marks)
    );

    aiSuggestedMarksJson[question.id] = question.parts.map(() => null);
    question.parts.forEach((part, i) => {
      if (part.answer_format !== 'extended') return;
      const studentAnswer = studentParts[i];
      if (!studentAnswer || studentAnswer.trim() === '') return; // nothing to mark
      tier2Jobs.push({
        questionId: question.id,
        partIndex: i,
        promise: markExtendedPart(
          { questionText: part.text, marks: part.marks, markScheme: part.mark_scheme, studentAnswer },
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

  const { error: insertError } = await admin.from('submissions').insert({
    worksheet_id: worksheet.id,
    student_id: worksheet.student_id,
    answers_json: sanitizedAnswers,
    auto_marks_json: autoMarksJson,
    ai_suggested_marks_json: aiSuggestedMarksJson,
  });

  if (insertError) {
    console.error('Failed to store submission', insertError);
    return NextResponse.json({ error: 'Could not submit your answers - please try again.' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
