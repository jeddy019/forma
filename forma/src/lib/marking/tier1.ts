import type { AnswerFormat } from '@/lib/ai/schema';
import { algebraicEquivalent } from '@/lib/marking/algebraic';

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
    // Phase B Wave 1 Step 71 (B12) - algebraic equivalence via mathjs
    // canonical-form comparison (src/lib/marking/algebraic.ts). Judges
    // "2(x+3)" and "2x+6" as the same answer. A null result means the input
    // was not safely comparable, so fall through to Tier 2/3 - never guess.
    case 'expression': {
      const equivalent = algebraicEquivalent(correctAnswer, studentAnswer);
      if (equivalent === null) return null;
      return { matched: equivalent, marks_awarded: equivalent ? marks : 0 };
    }
    case 'extended':
      return null;
  }
}
