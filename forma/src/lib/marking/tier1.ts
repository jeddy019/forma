import type { AnswerFormat } from '@/lib/ai/schema';

// Phase 3 Step 16 - Marking Logic (CLAUDE.md), Tier 1: instant auto-mark on
// submission for numerical, coordinates, true/false, and multiple choice.
// "extended" (shown working, explanations, proofs, essays) is not this
// tier's job - it returns null so the caller can route it to Tier 2 or 3,
// neither of which exist yet.
export interface Tier1Result {
  matched: boolean;
  marks_awarded: number;
}

const NUMERICAL_TOLERANCE = 0.01;

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

// Coordinates are matched after stripping all whitespace and lowercasing,
// not parsed as a structured pair - see the answer_format guidance in
// systemPrompt.ts, which tells the AI to write coordinates in one
// consistent minimal form (e.g. "(3, 4)") for exactly this reason.
function normaliseCoordinates(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export function markPart(
  answerFormat: AnswerFormat,
  correctAnswer: string,
  studentAnswer: string,
  marks: number
): Tier1Result | null {
  switch (answerFormat) {
    case 'numerical': {
      const correctNum = Number(correctAnswer.trim());
      const studentNum = Number(studentAnswer.trim());
      const matched =
        Number.isFinite(correctNum) && Number.isFinite(studentNum) && studentAnswer.trim() !== ''
          ? Math.abs(correctNum - studentNum) <= NUMERICAL_TOLERANCE
          : normalise(correctAnswer) === normalise(studentAnswer);
      return { matched, marks_awarded: matched ? marks : 0 };
    }
    case 'coordinates': {
      const matched = normaliseCoordinates(correctAnswer) === normaliseCoordinates(studentAnswer);
      return { matched, marks_awarded: matched ? marks : 0 };
    }
    case 'true_false':
    case 'multiple_choice': {
      const matched = normalise(correctAnswer) === normalise(studentAnswer);
      return { matched, marks_awarded: matched ? marks : 0 };
    }
    case 'extended':
      return null;
  }
}
