import OpenAI from 'openai';

// Same provider as generateWorksheet.ts - OpenAI (gpt-4o) is the standing
// default, not a temporary workaround (see that file's own header comment).
// This was built directly against OpenAI with no Anthropic path at all,
// since there was never a working Anthropic call for this feature to begin
// with - Phase 5 Step 25 was skipped entirely in every session before this
// one specifically because no AI provider was available (see CHANGELOG.md).
const openaiClient = new OpenAI();
const OPENAI_MODEL = 'gpt-4o';
// A parent report is a handful of short paragraphs, nowhere near
// generateWorksheet.ts's 16000-token budget - kept deliberately smaller so
// a runaway response fails fast rather than idling toward a large token bill.
const MAX_TOKENS = 2000;
const MAX_ATTEMPTS = 2;

const PARENT_REPORT_SYSTEM_PROMPT = `You are an experienced, warm tutor writing a short progress update to a student's parent, to be sent as an email. Write in second person to the parent, referring to their child by name.

Write 3 to 4 short paragraphs:
1. A warm opening naming what the student has been working on recently.
2. Specific, honest progress - reference real topics and scores where they are provided. Be encouraging but not empty praise - if scores show a genuine struggle, say so constructively.
3. One area to keep working on, framed positively (what to focus on next, not just what went wrong).
4. A brief, warm closing.

Do not invent facts, scores, or topics not present in the data given. If very little data is provided, write a shorter, more general but still genuine update rather than padding with invented specifics. Do not use markdown formatting - plain prose only, since this is rendered directly as email paragraphs. Return only valid JSON matching the schema, no markdown, no preamble.`;

const PARENT_REPORT_SCHEMA = {
  type: 'object',
  properties: {
    report_paragraphs: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['report_paragraphs'],
  additionalProperties: false,
};

export interface ParentReportInput {
  studentName: string;
  weaknesses: string | null;
  /** Most recent first. */
  sessionNotes: string[];
  /** Most recent first. */
  recentSubmissions: { topic: string; scorePercentage: number }[];
}

function buildUserPrompt(input: ParentReportInput): string {
  const lines = [`Student name: ${input.studentName}`];
  lines.push(`Known weaknesses: ${input.weaknesses ?? 'none recorded'}`);

  if (input.recentSubmissions.length > 0) {
    lines.push('Recent scored practice (most recent first):');
    for (const s of input.recentSubmissions) {
      lines.push(`- ${s.topic}: ${s.scorePercentage}%`);
    }
  } else {
    lines.push('Recent scored practice: none recorded yet.');
  }

  if (input.sessionNotes.length > 0) {
    lines.push('Recent tutor session notes (most recent first):');
    for (const note of input.sessionNotes) {
      lines.push(`- ${note}`);
    }
  } else {
    lines.push('Recent tutor session notes: none recorded.');
  }

  return lines.join('\n');
}

// Retry-once on invalid JSON/validation failure, same shape as
// generateWorksheet.ts (Technical Challenge 2) - no AbortSignal here since
// this is invoked from a plain server action (a button click, not a
// fetch-with-Cancel-button flow like the main generation screen).
export async function generateParentReport(input: ParentReportInput): Promise<string[]> {
  const userPrompt = buildUserPrompt(input);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: OPENAI_MODEL,
        max_completion_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: PARENT_REPORT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'parent_report', strict: true, schema: PARENT_REPORT_SCHEMA },
        },
      });

      const message = response.choices[0]?.message;
      if (message?.refusal) {
        throw new Error('Report generation was declined - please try again.');
      }
      const text = message?.content;
      if (!text) {
        throw new Error('AI response had no text content.');
      }

      const parsed = JSON.parse(text) as { report_paragraphs?: unknown };
      const paragraphs = parsed.report_paragraphs;
      if (!Array.isArray(paragraphs) || paragraphs.length === 0 || !paragraphs.every((p) => typeof p === 'string' && p.trim().length > 0)) {
        throw new Error('AI response did not match the expected report format.');
      }

      return paragraphs;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Report generation failed.');
}
