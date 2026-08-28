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

// B68: is a question_bank row (tagged rowExamBoard, NULL if board-agnostic)
// usable for a student pinned to pinnedBoard? A board-agnostic row is safe
// for any student; a tagged row only for the same board. No pinned board
// (null/undefined - the Ontario case, or simply "no board chosen") accepts
// everything, which is the pre-B68 catch-all behaviour.
export function bankRowUsableForBoard(rowExamBoard: string | null, pinnedBoard: string | null | undefined): boolean {
  if (!pinnedBoard) return true;
  if (!rowExamBoard) return true;
  return rowExamBoard === pinnedBoard;
}

// Phase 7 Step 42: called AFTER generation succeeds, once the AI's own
// inferred subject is known (see blendWithBank.ts's own comment for why
// this is post-hoc, not pre-hoc). country/curriculum_level come from the
// student profile; subject comes from the just-generated worksheet. When
// examBoard is set (B68 - the student's pinned board), rows from a different
// board are filtered out entirely; the PostgREST .or() mirrors
// bankRowUsableForBoard so the SQL filter and the row rule stay in step.
export async function pullVerifiedQuestions(
  supabase: SupabaseClient,
  country: Country,
  curriculumLevel: string,
  subject: Subject,
  examBoard?: string | null
): Promise<BankRow[]> {
  let query = supabase
    .from('question_bank')
    .select('id, sub_skill, question_json')
    .eq('country', country)
    .eq('curriculum_level', curriculumLevel)
    .eq('subject', subject)
    .not('verified_at', 'is', null)
    .not('sub_skill', 'is', null)
    .limit(BANK_QUERY_LIMIT);

  if (examBoard) {
    // Board-agnostic (NULL) rows stay eligible; rows from a competing board
    // are excluded. PostgREST .or() on a nullable TEXT column.
    query = query.or(`exam_board.is.null,exam_board.eq.${examBoard}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to query question_bank', error);
    return [];
  }

  return (data ?? []) as BankRow[];
}
