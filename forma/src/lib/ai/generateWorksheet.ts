import Anthropic from '@anthropic-ai/sdk';
import { WORKSHEET_SYSTEM_PROMPT } from './systemPrompt';
import { WORKSHEET_JSON_SCHEMA, validateWorksheet, type GeneratedWorksheet } from './schema';

const client = new Anthropic();

const MODEL = 'claude-haiku-4-5';
// 10 questions with diagram_specs and full mark schemes can run past 8000
// tokens - a truncated response looks identical to invalid JSON and burns a
// retry for no reason. 16000 stays well under the SDK's non-streaming
// timeout threshold (~16-21K tokens) so no need to switch to streaming.
const MAX_TOKENS = 16000;
const MAX_ATTEMPTS = 2;

export async function generateWorksheet(userPrompt: string, signal: AbortSignal): Promise<GeneratedWorksheet> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create(
        {
          model: MODEL,
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
      return validateWorksheet(parsed);
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
      // Retry once on any failure (invalid JSON, failed validation, transient
      // API error) - see CLAUDE.md Technical Challenge 2.
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Worksheet generation failed.');
}
