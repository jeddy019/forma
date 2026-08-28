import OpenAI from 'openai';

// Phase B Wave 4 (B72): post-quiz "Why is this wrong?" contextual explanation.
// A chat panel on the quiz review screen where the student asks about a part
// they got wrong, and the AI tutor explains against the REAL question, the
// student's OWN submitted answer, the accepted answer, and the mark scheme.
//
// PROVIDER: OpenAI (gpt-5.6-terra), the standing default - same as
// generateWorksheet.ts, generateParentReport.ts, and tier2.ts. The original
// B72 draft in CLAUDE.md named gpt-4o-mini; that model reference predates
// the standing-default decision (2026-08-22) and is stale, so this uses the
// same model as every other AI call in the product. No inactive Anthropic
// path here: generateParentReport.ts set the precedent that newer call sites
// are built OpenAI-only (the CLAUDE.md Tech Stack entry enumerates exactly
// the three files that carry the inactive Anthropic copies: generateWorksheet,
// tier2, generateParentReport - adding a fourth here would only mislead).
//
// SECURITY: this module never touches the browser directly. The route
// (/api/quiz/explain) assembles the student-answer + mark-scheme context
// SERVER-SIDE from the stored submission and mark_scheme_json (service-role
// only), and returns only the reply text - mark_scheme_json never reaches a
// student's browser (Security Rules 1). The client sends only {digitalCode,
// questionId, partIndex, history}.
import type { MarkScheme } from '@/lib/ai/schema';

const openaiClient = new OpenAI();

export const AI_TUTOR_MODEL = 'gpt-5.6-terra';
const MAX_TOKENS = 600;

export interface AiTutorMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiTutorContext {
  questionText: string;
  marks: number;
  subject: string;
  curriculum: string;
  yearLevel: string;
  subSkill: string;
  studentAnswer: string;
  correctAnswer: string;
  markScheme: MarkScheme;
}

const SYSTEM_PROMPT = `You are a warm, patient tutor helping a student understand a question they just attempted on their quiz. The student has already submitted their answers, so you are not doing their homework for them - they are here to learn.

You are given:
- The question text exactly as the student saw it.
- The student's own answer, exactly as they typed it.
- The accepted correct answer and the examiner's mark scheme.
- The subject, curriculum stage, and year/grade.

Explain, clearly and kindly, why their answer fell short and how to arrive at the correct one. Be encouraging - the student is practising and can improve. Match your register to the subject and curriculum: use "show your work" style phrasing for Ontario/the US, UK exam phrasing ("work out", "show your working") for England. Write any mathematical or scientific notation as inline LaTeX inside $...$ spans, exactly like the question text (e.g. $x^2$, $\\dfrac{2}{3}$). Keep the explanation to a few short paragraphs. Do not write raw HTML, do not mention "mark scheme" to the student - talk to them about the method instead. If their answer was actually acceptable for full marks, say so and why.`;

function buildContextText(context: AiTutorContext): string {
  const scheme = context.markScheme;
  return `Question (${context.curriculum}, ${context.yearLevel}, ${context.subject}, sub-skill: ${context.subSkill}):
${context.questionText}
[${context.marks} marks]

Student's answer:
${context.studentAnswer.trim() || '(blank - no answer given)'}

Accepted answer:
${context.correctAnswer}
Common error to watch for: ${scheme?.common_error ?? 'n/a'}
Acceptable equivalents: ${scheme?.allow ?? 'n/a'}`;
}

// Pure and exported for unit tests: builds the full OpenAI message array from
// the server-assembled context plus the student's chat history (already
// validated + HTML-stripped by the route).
export function buildAiTutorMessages(context: AiTutorContext, history: AiTutorMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildContextText(context) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export async function getAiTutorReply(context: AiTutorContext, history: AiTutorMessage[], signal: AbortSignal): Promise<string> {
  const response = await openaiClient.chat.completions.create(
    {
      model: AI_TUTOR_MODEL,
      // Small, well-defined conversational task - same reasoning_effort cap
      // as tier2.ts, so a reply lands in seconds rather than drifting.
      reasoning_effort: 'low',
      max_completion_tokens: MAX_TOKENS,
      messages: buildAiTutorMessages(context, history),
    },
    { signal }
  );

  const message = response.choices[0]?.message;
  if (message?.refusal) {
    throw new Error('AI tutor declined the request.');
  }
  const text = message?.content;
  if (!text) {
    throw new Error('AI tutor response had no text content.');
  }
  return text;
}