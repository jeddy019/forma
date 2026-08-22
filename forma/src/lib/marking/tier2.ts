import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Phase 3 Step 17 - Marking Logic (CLAUDE.md), Tier 2: AI-assisted marking
// for "extended" parts (shown working, explanations, proofs, extended
// writing) that Tier 1 can't auto-mark.
//
// PROVIDER: OpenAI (gpt-5.6-terra) is the standing default here, same as
// generateWorksheet.ts and generateParentReport.ts - not a temporary
// workaround pending an Anthropic restoration. Found live in a 2026-08-19
// audit that this file was the one AI-calling path in the project that
// never got the OpenAI swap those two did - it was still constructing
// `new Anthropic()` directly with no fallback, meaning every Tier 2 call
// was silently failing (caught by /api/submit's Promise.allSettled into a
// null result, logged, never surfaced) for as long as the Anthropic
// account has been unusable. Fixed the same way those two files already
// were: OpenAI is the active call, the original Anthropic call is kept
// below as markExtendedPartAnthropic, inactive, for a clean swap back if
// the Anthropic account is ever the deliberate choice again. Tech Stack's
// "claude-sonnet-4-6 for AI-assisted marking only" is superseded by this -
// gpt-5.6-terra (the same model already used for generation) is the
// standard now, not a second/different model tier.
const openaiClient = new OpenAI();
const anthropicClient = new Anthropic();

const OPENAI_MODEL = 'gpt-5.6-terra';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 512;

const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export interface Tier2Result {
  marks_awarded: number;
  reasoning: string;
  confidence: Confidence;
  // true when confidence is "low" - per the Marking Logic section, a low
  // confidence suggestion must be flagged for tutor review instead of
  // applied. Precomputed here so callers never have to re-derive the rule.
  needs_review: boolean;
}

export interface Tier2Input {
  questionText: string;
  marks: number;
  markScheme: {
    M1: string;
    A1: string;
    common_error: string;
    allow: string;
  };
  studentAnswer: string;
}

const SYSTEM_PROMPT = `You are an experienced exam marker awarding marks for extended-response answers - shown working, explanations, proofs, or extended writing - against a fixed mark scheme. You are given the question, the maximum marks available, the mark scheme (M1: the method mark, A1: the accuracy mark, Allow: acceptable equivalent forms, Common error: what students typically get wrong), and the student's own typed answer exactly as submitted.

Award marks_awarded as a whole number between 0 and the maximum, the way a human examiner applies M1/A1: award the method mark if the working shows the correct approach even when the final answer is wrong, and award the accuracy mark only if the final answer is correct or matches something in Allow. In reasoning, write one or two sentences citing exactly which mark scheme point was or was not met.

Set confidence to "high" only when the answer is unambiguous and clearly interpretable against the mark scheme; "medium" when reasonable examiner judgement was required; "low" when the answer is blank, off-topic, illegible, or genuinely ambiguous. A "low" confidence mark must never be applied automatically - it always needs a human tutor to review it, so when in doubt choose "low" rather than guess.

Return only valid JSON matching the schema. No markdown, no preamble.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    marks_awarded: { type: 'integer' },
    reasoning: { type: 'string' },
    confidence: { type: 'string', enum: [...CONFIDENCE_LEVELS] },
  },
  required: ['marks_awarded', 'reasoning', 'confidence'],
  additionalProperties: false,
};

function buildUserPrompt(input: Tier2Input): string {
  return `Question: ${input.questionText}
Maximum marks: ${input.marks}
Mark scheme:
M1 (method): ${input.markScheme.M1}
A1 (accuracy): ${input.markScheme.A1}
Allow: ${input.markScheme.allow}
Common error: ${input.markScheme.common_error}

Student's answer:
${input.studentAnswer}`;
}

function toResult(parsed: { marks_awarded: number; reasoning: string; confidence: Confidence }, maxMarks: number): Tier2Result {
  // Defensive clamp - a mark outside [0, marks] can't come from a correct
  // reading of the mark scheme, so treat it the same as any other model
  // slip rather than trusting it verbatim.
  const marksAwarded = Math.max(0, Math.min(maxMarks, Math.round(parsed.marks_awarded)));
  return {
    marks_awarded: marksAwarded,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    needs_review: parsed.confidence === 'low',
  };
}

export async function markExtendedPart(input: Tier2Input, signal: AbortSignal): Promise<Tier2Result> {
  const response = await openaiClient.chat.completions.create(
    {
      model: OPENAI_MODEL,
      // GPT-5.6 is a reasoning-hybrid model; this is a tiny, well-defined
      // judgement task and the spec budgets Tier 2 at ~5 seconds, so cap
      // reasoning effort explicitly instead of letting it default higher.
      reasoning_effort: 'low',
      max_completion_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(input) },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'tier2_marking', strict: true, schema: RESPONSE_SCHEMA },
      },
    },
    { signal }
  );

  const message = response.choices[0]?.message;
  if (message?.refusal) {
    throw new Error('AI marking was declined.');
  }

  const text = message?.content;
  if (!text) {
    throw new Error('AI marking response had no text content.');
  }

  const parsed = JSON.parse(text) as { marks_awarded: number; reasoning: string; confidence: Confidence };
  return toResult(parsed, input.marks);
}

// INACTIVE - the original Anthropic call path. Restore by swapping this
// back in as markExtendedPart's body if Anthropic is ever the deliberate
// choice again; anthropicClient/ANTHROPIC_MODEL above are kept in place for
// exactly this, same pattern as generateWorksheet.ts's own inactive path.
async function markExtendedPartAnthropic(input: Tier2Input, signal: AbortSignal): Promise<Tier2Result> {
  const response = await anthropicClient.messages.create(
    {
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(input) }],
      output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    },
    { signal }
  );

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
  if (!textBlock) {
    throw new Error('AI marking response had no text content.');
  }

  const parsed = JSON.parse(textBlock.text) as { marks_awarded: number; reasoning: string; confidence: Confidence };
  return toResult(parsed, input.marks);
}
void markExtendedPartAnthropic;
