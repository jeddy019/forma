import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { markPart } from '@/lib/marking/tier1';
import type { AnswerFormat } from '@/lib/ai/schema';

// R3 instant marking: the student page shows green/red per part as the
// student answers, but questions_json is deliberately answer-free
// (splitMarkScheme.ts strips answer/answer_format/mark_scheme into
// mark_scheme_json), so correctness can only be judged server-side. This
// endpoint runs the exact same Tier 1 matcher /api/submit uses and returns
// ONLY a status - never the expected answer, never marks, nothing that
// could reconstruct the mark scheme. "extended" parts return 'manual'
// (they are Tier 2/3's job at submission time).
export const runtime = 'nodejs';

const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const ANSWER_MAX_LENGTH = 2000;

interface CheckPartBody {
  digitalCode?: unknown;
  questionId?: unknown;
  partIndex?: unknown;
  answer?: unknown;
}

interface MarkSchemeJsonShape {
  questions?: Array<{
    id?: string;
    parts?: Array<{
      answer?: string;
      answer_format?: AnswerFormat;
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  let body: CheckPartBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const digitalCode = typeof body.digitalCode === 'string' ? body.digitalCode : '';
  const questionId = typeof body.questionId === 'string' ? body.questionId : '';
  const partIndex = typeof body.partIndex === 'number' ? Math.floor(body.partIndex) : -1;
  const answer = typeof body.answer === 'string' ? body.answer : '';

  if (!DIGITAL_CODE_PATTERN.test(digitalCode)) {
    return NextResponse.json({ error: 'Invalid worksheet code' }, { status: 400 });
  }
  if (!questionId || questionId.length > 64) {
    return NextResponse.json({ error: 'Invalid question' }, { status: 400 });
  }
  if (partIndex < 0 || partIndex > 20) {
    return NextResponse.json({ error: 'Invalid part' }, { status: 400 });
  }
  if (answer.length > ANSWER_MAX_LENGTH) {
    return NextResponse.json({ error: 'Answer too long' }, { status: 400 });
  }
  if (answer.trim() === '') {
    return NextResponse.json({ status: 'cleared' });
  }

  const admin = createAdminClient();
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('mark_scheme_json')
    .eq('digital_code', digitalCode)
    .single<{ mark_scheme_json: MarkSchemeJsonShape | null }>();

  const schemeQuestion = worksheet?.mark_scheme_json?.questions?.find((q) => q.id === questionId);
  const schemePart = schemeQuestion?.parts?.[partIndex];
  if (!schemePart || typeof schemePart.answer !== 'string') {
    return NextResponse.json({ status: 'manual' });
  }

  const format: AnswerFormat = schemePart.answer_format ?? 'extended';
  // Marks value is irrelevant here - this endpoint returns only the matched
  // boolean, never marks_awarded.
  const result = markPart(format, schemePart.answer, answer, 1);
  if (!result) {
    return NextResponse.json({ status: 'manual' });
  }
  return NextResponse.json({ status: result.matched ? 'correct' : 'incorrect' });
}
