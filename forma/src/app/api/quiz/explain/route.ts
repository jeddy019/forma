export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAiTutorReply, type AiTutorMessage } from '@/lib/quiz/aiTutor';
import { aiTutorAllowance } from '@/lib/payments/planStatus';
import { stripHtmlTags } from '@/lib/ai/sanitize';
import type { AnswerFormat } from '@/lib/ai/schema';

// Phase B Wave 4 (B72): AI tutor chat - the post-quiz "Why is this wrong?"
// contextual explanation. A public route (invoked from the quiz review screen;
// the student may be anonymous, same as /api/quiz/solution and re-practice).
//
// SECURITY + GATING:
//   - The question/mark-scheme context is assembled HERE, server-side, from
//     the service-role-only mark_scheme_json + the stored submission. The
//     client sends only { digitalCode, questionId, partIndex, history } and
//     receives only the reply text - mark_scheme_json never reaches a
//     student's browser (Security Rules 1).
//   - Entitlement comes from the WORKSHEET OWNER's plan (aiTutorAllowance:
//     Pro unlimited, Basic 5/quiz, Free none) - the student on the other end
//     may not even have an account, so the gate is the person who generated
//     the quiz, resolved server-side from the worksheet, never client-asserted.
//   - The student's own answer is read from the stored submission, not from
//     the client - an attacker cannot smuggle a different "student answer"
//     to influence the explanation.
//   - A submission must already exist (post-quiz only), the same gate the
//     worked-solution route uses - the AI tutor is a reward for attempting,
//     not a mid-quiz answer machine.
const DIGITAL_CODE_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;
const HISTORY_MAX_MESSAGES = 20;
const MESSAGE_MAX_LENGTH = 2000;
const AI_TUTOR_TIMEOUT_MS = 15_000; // Performance Rule 10: same 15s budget as Marking AI

interface ExplainBody {
  digitalCode?: unknown;
  questionId?: unknown;
  partIndex?: unknown;
  history?: unknown;
}

interface QuestionsJsonPart {
  part_label: string | null;
  text: string;
  marks: number;
}

interface QuestionsJsonQuestion {
  id: string;
  sub_skill?: string;
  parts: QuestionsJsonPart[];
}

interface MarkSchemeJsonPart {
  part_label: string | null;
  answer: string | null;
  answer_format?: AnswerFormat | null;
  M1: string | null;
  A1: string | null;
  common_error: string | null;
  allow: string | null;
}

interface MarkSchemeJsonQuestion {
  id: string;
  parts: MarkSchemeJsonPart[];
}

export async function POST(request: NextRequest) {
  let body: ExplainBody;
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

  // history: the chat so far (including the student's latest question). Each
  // entry is HTML-stripped before it can reach the model (Security Rule 7),
  // and both the count and per-message length are capped to bound abuse.
  let history: AiTutorMessage[] = [];
  if (Array.isArray(body.history)) {
    if (body.history.length > HISTORY_MAX_MESSAGES) {
      return NextResponse.json({ error: 'Too many messages.' }, { status: 400 });
    }
    history = body.history
      .filter((m): m is { role?: unknown; content?: unknown } => typeof m === 'object' && m !== null)
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: typeof m.content === 'string' ? stripHtmlTags(m.content).trim() : '',
      }))
      .filter((m) => m.content.length > 0 && m.content.length <= MESSAGE_MAX_LENGTH);
  }
  const lastUserMessage = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) {
    return NextResponse.json({ error: 'Ask a question first.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: worksheet } = await admin
    .from('worksheets')
    .select('id, owner_id, expires_at, subject, topic, questions_json, mark_scheme_json')
    .eq('digital_code', digitalCode)
    .single<{
      id: string;
      owner_id: string | null;
      expires_at: string | null;
      subject: string | null;
      topic: string;
      questions_json: { curriculum: string; year_level: string; questions: QuestionsJsonQuestion[] };
      mark_scheme_json: { questions: MarkSchemeJsonQuestion[] } | null;
    }>();

  if (!worksheet) {
    return NextResponse.json({ error: 'This link is invalid.' }, { status: 404 });
  }
  if (worksheet.expires_at !== null && new Date(worksheet.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 410 });
  }
  if (!worksheet.owner_id) {
    return NextResponse.json({ error: 'This quiz has no owner.' }, { status: 404 });
  }

  // Gate 1: a submission must already exist (post-quiz only - see file header).
  const { data: submission } = await admin
    .from('submissions')
    .select('id, answers_json')
    .eq('worksheet_id', worksheet.id)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; answers_json: Record<string, string[]> | null }>();

  if (!submission) {
    return NextResponse.json({ error: 'Submit your answers before asking the AI tutor.' }, { status: 403 });
  }

  // Gate 2: owner plan entitlement.
  const { data: ownerRow } = await admin
    .from('users')
    .select('plan, plan_expires_at')
    .eq('id', worksheet.owner_id)
    .single<{ plan: string | null; plan_expires_at: string | null }>();

  const allowance = aiTutorAllowance(ownerRow?.plan, ownerRow?.plan_expires_at);
  if (allowance === 0) {
    return NextResponse.json({ error: 'The AI tutor is part of the Pro plan.' }, { status: 403 });
  }

  // Gate 3: per-quiz cap for finite allowances (Basic: 5/quiz). Pro (Infinity)
  // skips the count entirely. Count-then-insert on usage_log is not atomic,
  // so a Basic student racing the boundary could sneak one extra message -
  // a soft cap, not the revenue-critical free-tier check, so a narrow race is
  // acceptable; noted for whoever builds the subscription boundaries properly.
  if (Number.isFinite(allowance)) {
    const { count } = await admin
      .from('usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', worksheet.owner_id)
      .eq('action', 'ai_tutor')
      .eq('metadata->>worksheet_id', worksheet.id);

    if ((count ?? 0) >= allowance) {
      return NextResponse.json({ error: `You have reached the AI tutor limit for this quiz.` }, { status: 429 });
    }
  }

  // Assemble the server-side context: real question text, the student's OWN
  // stored answer for this part, and the accepted answer + mark scheme.
  const question = worksheet.questions_json.questions.find((q) => q.id === questionId);
  if (!question || !question.parts[partIndex]) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
  }
  const part = question.parts[partIndex];
  const questionText = part.part_label
    ? `${part.text}\n(Part (${part.part_label}))`
    : part.text;

  const schemeQuestion = worksheet.mark_scheme_json?.questions?.find((q) => q.id === questionId);
  const schemePart = schemeQuestion?.parts?.[partIndex];
  const studentAnswer = submission.answers_json?.[questionId]?.[partIndex] ?? '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TUTOR_TIMEOUT_MS);

  let reply: string;
  try {
    reply = await getAiTutorReply(
      {
        questionText,
        marks: part.marks,
        subject: worksheet.subject ?? '',
        curriculum: worksheet.questions_json.curriculum ?? '',
        yearLevel: worksheet.questions_json.year_level ?? '',
        subSkill: question.sub_skill ?? '',
        studentAnswer: stripHtmlTags(studentAnswer).trim(),
        correctAnswer: schemePart?.answer ?? '',
        markScheme: {
          M1: schemePart?.M1 ?? '',
          A1: schemePart?.A1 ?? '',
          common_error: schemePart?.common_error ?? '',
          allow: schemePart?.allow ?? '',
          worked_solution: undefined,
        },
      },
      history,
      controller.signal
    );
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    console.error('AI tutor call failed', aborted ? '(timeout)' : '', error);
    return NextResponse.json(
      { error: aborted ? 'The AI tutor is taking a little longer than expected - please try again.' : 'Could not get an answer - please try again.' },
      { status: 504 }
    );
  } finally {
    clearTimeout(timeout);
  }

  // Log usage once (only a successful reply counts against the quota), keyed
  // to the worksheet so the per-quiz cap above can count it back.
  try {
    await admin.from('usage_log').insert({
      user_id: worksheet.owner_id,
      action: 'ai_tutor',
      metadata: { worksheet_id: worksheet.id, question_id: questionId, part_index: partIndex },
    });
  } catch (error) {
    console.error('Failed to log AI tutor usage', error);
  }

  return NextResponse.json({ reply }, { status: 200 });
}