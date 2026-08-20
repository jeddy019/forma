import type { SupabaseClient } from '@supabase/supabase-js';
import type { Country, Subject } from '@/lib/constants';
import type { AnswerFormat, MarkScheme } from '@/lib/ai/schema';

// Matches question_bank.question_json's shape exactly as
// admin/question-bank/actions.ts's createQuestionAction writes it - no
// diagram_spec/working_lines/part_label, since the admin form never
// collects those (see blendWithBank.ts for how the gaps are filled in).
export interface BankQuestionJson {
  text: string;
  marks: number;
  answer_format: AnswerFormat;
  answer: string;
  mark_scheme: MarkScheme;
}

export interface BankRow {
  id: string;
  sub_skill: string;
  question_json: BankQuestionJson;
}

// Performance Rule 3 style cap, matching WORKSHEET_HISTORY_LIMIT-style caps
// elsewhere - a generous ceiling, not expected to bind in practice while
// the bank is still small.
const BANK_QUERY_LIMIT = 500;

// Phase 7 Step 42: called AFTER generation succeeds, once the AI's own
// inferred subject is known (see blendWithBank.ts's own comment for why
// this is post-hoc, not pre-hoc). country/curriculum_level come from the
// student profile; subject comes from the just-generated worksheet.
export async function pullVerifiedQuestions(
  supabase: SupabaseClient,
  country: Country,
  curriculumLevel: string,
  subject: Subject
): Promise<BankRow[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, sub_skill, question_json')
    .eq('country', country)
    .eq('curriculum_level', curriculumLevel)
    .eq('subject', subject)
    .not('verified_at', 'is', null)
    .not('sub_skill', 'is', null)
    .limit(BANK_QUERY_LIMIT);

  if (error) {
    console.error('Failed to query question_bank', error);
    return [];
  }

  return (data ?? []) as BankRow[];
}
