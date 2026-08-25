import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { WORKSHEET_SYSTEM_PROMPT } from './systemPrompt';
import { WORKSHEET_JSON_SCHEMA, validateWorksheet, EXPECTED_TYPE_ORDER, type GeneratedWorksheet, type QuestionType } from './schema';
import { stripNulCharacters } from './sanitize';

// PROVIDER: OpenAI (gpt-5.6-terra) is the standing default, per the user
// directly (2026-08-22, upgrading from gpt-4o) - not a temporary
// workaround pending an Anthropic restoration. Supersedes Tech Stack's
// old claude-haiku/gpt-4o lines. The Anthropic client and its original
// call are kept below, unused, as an alternate path - not a "restore
// this" placeholder, just a clean swap available if Anthropic is ever the
// deliberate choice again. WORKSHEET_JSON_SCHEMA (schema.ts) is unchanged
// - every object node already sets additionalProperties:false and lists
// every property as required, which happens to satisfy OpenAI Structured
// Outputs' strict-mode rules as well as Anthropic's, so no schema edit
// was needed for the swap.
const openaiClient = new OpenAI();
const anthropicClient = new Anthropic();

// Deliberately gpt-5.6-terra (mid-tier of OpenAI's current GPT-5.6
// generation, and their own recommended default for production workloads)
// - user asked for a materially better model than the previous gpt-4o
// without flagship pricing ($2/$12 per 1M tokens vs gpt-4o's $2.50/$10,
// i.e. cost-neutral, a full generation newer). No other code path depends
// on which OpenAI model this constant names.
const OPENAI_MODEL = 'gpt-5.6-terra';
const ANTHROPIC_MODEL = 'claude-haiku-4-5';
// 10 questions with diagram_specs and full mark schemes can run past 8000
// tokens - a truncated response looks identical to invalid JSON and burns a
// retry for no reason. 16000 stays well under either provider's
// non-streaming timeout threshold so no need to switch to streaming.
const MAX_TOKENS = 16000;
const MAX_ATTEMPTS = 2;

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

// INACTIVE - the original Anthropic call path. Swap this back in as
// generateWorksheet's body if Anthropic is ever the deliberate choice
// again; anthropicClient/ANTHROPIC_MODEL above are kept in place for
// exactly this.
async function generateWorksheetAnthropic(
  userPrompt: string,
  signal: AbortSignal,
  expectedTypeOrder: QuestionType[] = EXPECTED_TYPE_ORDER
): Promise<GeneratedWorksheet> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await anthropicClient.messages.create(
        {
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_TOKENS,
          system: WORKSHEET_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
          output_config: { format: { type: 'json_schema', schema: WORKSHEET_JSON_SCHEMA } },
        },
        { signal }
      );

      if (response.stop_reason === 'refusal') {
        throw new Error('Generation was declined - please rephrase the topic.');
      }

      const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
      if (!textBlock) {
        throw new Error('AI response had no text content.');
      }

      const parsed = JSON.parse(textBlock.text);
      return validateWorksheet(stripNulCharacters(parsed), expectedTypeOrder);
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Worksheet generation failed.');
}
void generateWorksheetAnthropic;
