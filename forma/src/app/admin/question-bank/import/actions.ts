'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdminEmail';
import {
  validateBankRecord,
  normalizeQuestionText,
  MAX_IMPORT_ROWS,
  IMPORT_BATCH_SIZE,
  IMPORT_TEXT_MAX_CHARACTERS,
  type ImportBankRecord,
} from '@/lib/questionBank/importValidation';

export interface QuestionBankImportResult {
  error?: string;
  success?: boolean;
  summary?: {
    total: number;
    inserted: number;
    skippedExisting: number;
    failed: number;
    failures: string[];
  };
}

// B69 bulk import: every admin action re-verifies admin status server-side -
// same requireAdmin discipline as the other question-bank actions. Imported
// rows are marked verified immediately (verified_by/verified_at set here)
// because extraction curates and checks content before it is imported - the
// whole point of Wave 6 is educator-reviewed questions arriving ready to
// blend, not a second review pass at import time.
async function requireAdmin(): Promise<{ error?: string; email?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    return { error: 'Not authorized.' };
  }
  return { email: user.email };
}

export async function importQuestionsAction(
  _prevState: QuestionBankImportResult,
  formData: FormData
): Promise<QuestionBankImportResult> {
  const auth = await requireAdmin();
  if (auth.error || !auth.email) return { error: auth.error };
  const email = auth.email;

  let rawText = '';
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    rawText = await file.text();
  } else {
    rawText = String(formData.get('json') ?? '').trim();
  }
  rawText = rawText.trim();
  if (!rawText) return { error: 'Paste question JSON or upload a file.' };
  if (rawText.length > IMPORT_TEXT_MAX_CHARACTERS) {
    return { error: `Import text must be ${IMPORT_TEXT_MAX_CHARACTERS} characters or fewer.` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { error: 'The JSON could not be parsed - check for trailing commas or invalid characters.' };
  }
  if (!Array.isArray(parsed)) return { error: 'The JSON must be an array of question records.' };
  if (parsed.length === 0) return { error: 'No question records found in the JSON.' };
  if (parsed.length > MAX_IMPORT_ROWS) return { error: `At most ${MAX_IMPORT_ROWS} question records per import.` };

  const valid: ImportBankRecord[] = [];
  const failures: string[] = [];
  parsed.forEach((raw, i) => {
    const result = validateBankRecord(raw, i);
    if (result.ok) valid.push(result.record);
    else failures.push(result.error);
  });

  if (valid.length === 0) {
    return { error: `No valid questions to import. First problem: ${failures[0] ?? 'unknown'}` };
  }

  const admin = createAdminClient();

  // Dedupe against existing rows by normalized question text, scoped to each
  // (country, subject) pair seen in the batch - a question already in the
  // bank is skipped, not duplicated. One query per pair, not per row.
  const pairs = [...new Set(valid.map((r) => `${r.country}\u0000${r.subject}`))];
  const existingTexts = new Set<string>();
  for (const pair of pairs) {
    const [country, subject] = pair.split('\u0000');
    const { data } = await admin
      .from('question_bank')
      .select('question_json')
      .eq('country', country)
      .eq('subject', subject)
      .not('question_json', 'is', null)
      .limit(MAX_IMPORT_ROWS);
    for (const row of data ?? []) {
      const text = (row.question_json as { text?: unknown } | null)?.text;
      if (typeof text === 'string' && text) existingTexts.add(normalizeQuestionText(text));
    }
  }

  const toInsert = [];
  let skippedExisting = 0;
  for (const record of valid) {
    if (existingTexts.has(normalizeQuestionText(record.question.text))) {
      skippedExisting++;
      continue;
    }
    toInsert.push({
      country: record.country,
      curriculum_level: record.curriculum_level,
      subject: record.subject,
      topic: record.topic,
      sub_skill: record.sub_skill,
      exam_board: record.exam_board,
      question_json: record.question,
      verified_by: email,
      verified_at: new Date().toISOString(),
    });
  }

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += IMPORT_BATCH_SIZE) {
    const batch = toInsert.slice(i, i + IMPORT_BATCH_SIZE);
    const { error } = await admin.from('question_bank').insert(batch);
    if (error) {
      console.error('Bank import batch failed', error);
      failures.push(`DB insert of ${batch.length} row(s) failed: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  revalidatePath('/admin/question-bank');

  return {
    success: true,
    summary: {
      total: parsed.length,
      inserted,
      skippedExisting,
      failed: parsed.length - inserted - skippedExisting,
      failures: failures.slice(0, 10),
    },
  };
}