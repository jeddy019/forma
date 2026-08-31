// W5 B75: the pure "shape" decisions for a quiz - how many questions and in
// what type order (warm-up/core/challenge). Extracted from generateQuiz so
// the cram-mode override (B75) is unit-testable in isolation and every
// caller's board shape is one canonical source of truth.
//
// Rules (see generateQuiz):
//   - daily / cram: every question is core (no warm-up, no challenge), padded
//     to the count - daily follows the volume dial, cram defaults to 20.
//   - focus sets (re-practice / study / fundamentals): short 5-core board
//     unless overridden - EXCEPT cram, which is a full 20-core board even
//     though it is focus-targeted.
//   - everything else: the standard 10-question worksheet (2 warm-up, 6 core,
//     2 challenge).

import { EXPECTED_TYPE_ORDER, DAILY_TYPE_ORDER, type QuestionType } from '@/lib/ai/schema';

export type QuizGeneratedFrom = 'quiz' | 're-practice' | 'study' | 'daily' | 'cram';

export type QuizShapeQuestionCount = 5 | 10 | 15 | 20;

export interface QuizShapeInput {
  generatedFrom: QuizGeneratedFrom;
  focusSubSkills?: string[];
  fundamentalsTarget?: unknown;
  questionCount?: QuizShapeQuestionCount;
}

export interface QuizShape {
  questionCount: QuizShapeQuestionCount;
  typeOrder: QuestionType[];
}

export function resolveQuizShape(input: QuizShapeInput): QuizShape {
  const isFocus =
    Boolean(input.focusSubSkills && input.focusSubSkills.length > 0) || Boolean(input.fundamentalsTarget);
  const isCram = input.generatedFrom === 'cram';

  const questionCount = isCram
    ? (input.questionCount ?? 20)
    : input.questionCount ?? (isFocus ? 5 : 10);

  const typeOrder: QuestionType[] =
    input.generatedFrom === 'daily' || isCram
      ? (new Array(questionCount).fill('core') as QuestionType[])
      : isFocus
        ? DAILY_TYPE_ORDER
        : EXPECTED_TYPE_ORDER;

  return { questionCount, typeOrder };
}
