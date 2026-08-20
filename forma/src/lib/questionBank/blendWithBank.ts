import { slugifySubSkill } from '../subSkill/slugifySubSkill';
import type { GeneratedWorksheet } from '../ai/schema';
import type { BankRow } from './pullVerifiedQuestions';

export interface BlendResult {
  worksheet: GeneratedWorksheet;
  bankQuestionIdsUsed: string[];
}

// Phase 7 Step 42: post-hoc replacement, not pre-hoc "ask the AI to skip N
// slots" - bank matching is keyed on sub_skill, which is only known AFTER
// the AI has decomposed the freeform topic prompt, so asking it to skip
// slots upfront would need a separate decomposition call or unreliable
// freeform-topic matching. Generating the full worksheet first, then
// swapping matched slots by the AI's own (system-prompt-taught, canonical)
// sub_skill needs no schema change and can't break validateWorksheet's
// exact-count/type-order check, since only a question's `parts` change,
// never its id/type/sub_skill or the total question count.
//
// A bank question's question_json has no diagram_spec/working_lines/
// part_label (the admin form never collects those) - filled in here with
// safe defaults: no diagram, a single unlabelled part, 4 working lines
// (matching this project's own seed-data convention elsewhere).
export function blendWithBank(worksheet: GeneratedWorksheet, bankRows: BankRow[], rng: () => number = Math.random): BlendResult {
  if (bankRows.length === 0) {
    return { worksheet, bankQuestionIdsUsed: [] };
  }

  const bySlug = new Map<string, BankRow[]>();
  for (const row of bankRows) {
    const key = slugifySubSkill(row.sub_skill);
    if (!key) continue;
    const existing = bySlug.get(key);
    if (existing) existing.push(row);
    else bySlug.set(key, [row]);
  }

  const bankQuestionIdsUsed: string[] = [];
  const questions = worksheet.questions.map((question) => {
    const matches = bySlug.get(slugifySubSkill(question.sub_skill));
    if (!matches || matches.length === 0) return question;

    const chosen = matches[Math.floor(rng() * matches.length)];
    bankQuestionIdsUsed.push(chosen.id);
    const q = chosen.question_json;

    return {
      ...question,
      parts: [
        {
          part_label: null,
          text: q.text,
          marks: q.marks,
          diagram_spec: null,
          working_lines: 4,
          answer: q.answer,
          answer_format: q.answer_format,
          mark_scheme: q.mark_scheme,
        },
      ],
    };
  });

  return { worksheet: { ...worksheet, questions }, bankQuestionIdsUsed };
}
