import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Phase B Wave 1 (B4): returns the worked step-by-step solution for a single
// quiz part, for the post-submission review screen. Same server-side model as
// /api/check-part: mark_scheme_json (which now carries worked_solution) is
// NEVER readable by a student's browser directly (Security Rules 1) - only
// this service-role route reads it, and it returns ONLY the raw step strings,
// never the rest of the mark scheme.
//
// Gate: a submission must already exist for this worksheet. The whole point
// of worked solutions is to explain a wrong answer AFTER the student has
// attempted it - revealing steps before submission would hand over the answer
// mid-quiz. Older worksheets authored before worked_solution existed return
// an empty steps array and the UI simply omits the reveal for that part.
export const runtime = 'nodejs';

const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

interface SolutionBody {
  digitalCode?: unknown;
  questionId?: unknown;
  partIndex?: unknown;
}

interface MarkSchemeJsonQuestion {
  id: string;
  parts?: Array<{
    worked_solution?: string[];
  }>;
}

export async function POST(request: NextRequest) {
  let body: SolutionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const digitalCode = typeof body.digitalCode === 'string' ? body.digitalCode : '';
  const questionId = typeof body.questionId === 'string' ? body.questionId : '';
  const partIndex = typeof body.partIndex === 'number' ? Math.floor(body.partIndex) : -1;

  if (!DIGITAL_CODE_PATTERN.test(digitalCode)) {
    return NextResponse.json({ error: 'Invalid worksheet code.' }, { status: 400 });
  }
  if (!questionId || questionId.length > 64) {
    return NextResponse.json({ error: 'Invalid question.' }, { status: 400 });
  }
  if (partIndex < 0 || partIndex > 20) {
    return NextResponse.json({ error: 'Invalid part.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: worksheet } = await admin
    .from('worksheets')
    .select('id, mark_scheme_json')
    .eq('digital_code', digitalCode)
    .single<{ id: string; mark_scheme_json: { questions: MarkSchemeJsonQuestion[] } | null }>();

  if (!worksheet) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }

  // Gate: only reveal worked solutions once the student has submitted.
  const { data: submission } = await admin
    .from('submissions')
    .select('id')
    .eq('worksheet_id', worksheet.id)
    .limit(1)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: 'Submit your answers before reviewing the solutions.' }, { status: 403 });
  }

  const schemeQuestion = worksheet.mark_scheme_json?.questions?.find((q) => q.id === questionId);
  const steps = schemeQuestion?.parts?.[partIndex]?.worked_solution ?? [];

  return NextResponse.json({ steps }, { status: 200 });
}
