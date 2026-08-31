import OpenAI from 'openai';
import { WORKSHEET_SYSTEM_PROMPT } from './systemPrompt';
import { WORKSHEET_JSON_SCHEMA, validateWorksheet, EXPECTED_TYPE_ORDER, type GeneratedWorksheet, type QuestionType, type Question } from './schema';
import { stripNulCharacters } from './sanitize';

// PROVIDER: OpenAI (gpt-5.6-terra) is the standing default, per the user
// directly (2026-08-22, upgrading from gpt-4o) - not a temporary
// workaround. WORKSHEET_JSON_SCHEMA (schema.ts) is unchanged - every
// object node already sets additionalProperties:false and lists every
// property as required, which satisfies OpenAI Structured Outputs'
// strict-mode rules.
const openaiClient = new OpenAI();

// Deliberately gpt-5.6-terra (mid-tier of OpenAI's current GPT-5.6
// generation, and their own recommended default for production workloads)
// - user asked for a materially better model than the previous gpt-4o
// without flagship pricing ($2/$12 per 1M tokens vs gpt-4o's $2.50/$10,
// i.e. cost-neutral, a full generation newer). No other code path depends
// on which OpenAI model this constant names.
const OPENAI_MODEL = 'gpt-5.6-terra';
// 10 questions with diagram_specs and full mark schemes can run past 8000
// tokens - a truncated response looks identical to invalid JSON and burns a
// retry for no reason. 16000 stays well under either provider's
// non-streaming timeout threshold so no need to switch to streaming.
const MAX_TOKENS = 16000;
const MAX_ATTEMPTS = 2;

/**
 * Build a minimal AI-generated worksheet object around deterministic
 * questions so the downstream pipeline (DB insert, PDF render, marking)
 * sees a complete GeneratedWorksheet without calling OpenAI.
 */
export function buildWorksheetFromDeterministic(
  deterministicQuestions: Question[],
  metadata: {
    subject: string;
    topic: string;
    curriculum: string;
    year_level: string;
    difficulty: string;
    alignment_note: string;
  }
): GeneratedWorksheet {
  return {
    subject: metadata.subject as GeneratedWorksheet['subject'],
    topic: metadata.topic,
    curriculum: metadata.curriculum as GeneratedWorksheet['curriculum'],
    year_level: metadata.year_level,
    difficulty_overall: metadata.difficulty as GeneratedWorksheet['difficulty_overall'],
    alignment_note: metadata.alignment_note,
    questions: deterministicQuestions,
  };
}

export async function generateWorksheet(
  userPrompt: string,
  signal: AbortSignal,
  expectedTypeOrder: QuestionType[] = EXPECTED_TYPE_ORDER
): Promise<GeneratedWorksheet> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openaiClient.chat.completions.create(
        {
          model: OPENAI_MODEL,
          // GPT-5.6 is a reasoning-hybrid model. Measured live during the
          // swap from gpt-4o (2026-08-22): at default reasoning effort a
          // full 10-question generation ran 38.7s, over the route's hard
          // 30s abort (GENERATION_TIMEOUT_MS). 'low' keeps curriculum-
          // quality output inside the budget - the schema and system
          // prompt do the structural heavy lifting.
          reasoning_effort: 'low',
          max_completion_tokens: MAX_TOKENS,
          messages: [
            { role: 'system', content: WORKSHEET_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'worksheet', strict: true, schema: WORKSHEET_JSON_SCHEMA },
          },
        },
        { signal }
      );

      const message = response.choices[0]?.message;
      if (message?.refusal) {
        throw new Error('Generation was declined - please rephrase the topic.');
      }

      const text = message?.content;
      if (!text) {
        throw new Error('AI response had no text content.');
      }

      const parsed = JSON.parse(text);
      return validateWorksheet(stripNulCharacters(parsed), expectedTypeOrder);
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
      // Retry once on any failure (invalid JSON, failed validation, transient
      // API error) - see CLAUDE.md Technical Challenge 2.
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Worksheet generation failed.');
}

