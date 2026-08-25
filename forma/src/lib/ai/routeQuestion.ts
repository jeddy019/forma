import type { Question, QuestionType, GeneratedWorksheet } from './schema';
import { EXPECTED_TYPE_ORDER, DAILY_TYPE_ORDER } from './schema';

export interface SlotAssignment {
  /** Indices (0-based) that the deterministic engine should fill. */
  deterministic: number[];
  /** Indices the AI will fill (including diagram generation for deterministic questions). */
  ai: number[];
  /** The deterministic engine's generator key matched by routeQuestion. */
  generatorKey: string | null;
}

/**
 * Given a topic string, decide which question slots go to the Python maths
 * engine vs the AI. Returns null generatorKey if nothing matched.
 *
 * Strategy: when the maths engine matches, ALL slots go deterministic.
 * The AI never fills individual slots — it either owns the whole worksheet
 * or owns nothing. This keeps the boundary clean: one source per document.
 */
export function assignSlots(
  topic: string,
  matchedKeys: string[],
): SlotAssignment | null {
  if (!matchedKeys || matchedKeys.length === 0) {
    return null;
  }

  const allIndices = EXPECTED_TYPE_ORDER.map((_, i) => i);
  return {
    deterministic: allIndices,
    ai: [],
    generatorKey: matchedKeys[0],
  };
}

/**
 * Merge deterministic questions into an AI-generated worksheet.
 *
 * When the maths engine generates a partial set (e.g. only the 4
 * simultaneous-equations questions), the AI fills the rest. This function
 * replaces the deterministic slots in the AI's output while preserving
 * the AI's diagram generation for those slots.
 */
export function mergeDeterministicSlots(
  aiWorksheet: GeneratedWorksheet,
  deterministicQuestions: Question[],
  deterministicIndices: number[],
): GeneratedWorksheet {
  const questions = [...aiWorksheet.questions];

  for (let i = 0; i < deterministicIndices.length; i++) {
    const idx = deterministicIndices[i];
    if (idx < questions.length && i < deterministicQuestions.length) {
      questions[idx] = deterministicQuestions[i];
    }
  }

  return { ...aiWorksheet, questions };
}
