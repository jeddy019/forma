import Anthropic from '@anthropic-ai/sdk';

// Phase 3 Step 17 - Marking Logic (CLAUDE.md), Tier 2: AI-assisted marking
// for "extended" parts (shown working, explanations, proofs, extended
// writing) that Tier 1 can't auto-mark. Uses claude-sonnet-4-6, per Tech
// Stack ("claude-sonnet-4-6 for AI-assisted marking only").
const client = new Anthropic();

const MODEL = 'claude-sonnet-4-6';
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

export async function markExtendedPart(input: Tier2Input, signal: AbortSignal): Promise<Tier2Result> {
  const userPrompt = `Question: ${input.questionText}
Maximum marks: ${input.marks}
Mark scheme:
M1 (method): ${input.markScheme.M1}
A1 (accuracy): ${input.markScheme.A1}
Allow: ${input.markScheme.allow}
Common error: ${input.markScheme.common_error}

Student's answer:
${input.studentAnswer}`;

  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    },
    { signal }
  );

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
  if (!textBlock) {
    throw new Error('AI marking response had no text content.');
  }

  const parsed = JSON.parse(textBlock.text) as {
    marks_awarded: number;
    reasoning: string;
    confidence: Confidence;
  };

  // Defensive clamp - a mark outside [0, marks] can't come from a correct
  // reading of the mark scheme, so treat it the same as any other model
  // slip rather than trusting it verbatim.
  const marksAwarded = Math.max(0, Math.min(input.marks, Math.round(parsed.marks_awarded)));

  return {
    marks_awarded: marksAwarded,
    reasoning: parsed.reasoning,
    confidence: parsed.confidence,
    needs_review: parsed.confidence === 'low',
  };
}
