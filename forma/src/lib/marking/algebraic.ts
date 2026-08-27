import { parse, rationalize, simplify } from 'mathjs';

// Phase B Wave 1 Step 71 (B12) - Algebraic equivalence for Tier 1
// auto-marking. This is how maths answers in the "expression" answer_format
// are judged: a student's typed answer and the stored correct answer are
// declared equivalent if they reduce to the same canonical polynomial, so
// "2(x+3)" is marked the same as "2x+6", "(x+2)(x-3)" the same as
// "x^2 - x - 6", and so on - without the student having to write the answer
// in exactly the form the AI stored.
//
// The canonical form is produced by mathjs's rationalize(), which expands
// a parseable expression into its numerator/denominator (a canonical
// polynomial ratio). Two expressions are algebraically equivalent iff the
// difference of their rationalized forms simplifies to zero.
//
// Equations ("x = 3", "2x + 6 = 0") are handled by reducing each side to the
// "must be zero" form (LHS - RHS) first, then comparing - accepting both the
// difference and the negated sum, so "3 = x" matches "x = 3" either way round.
//
// SAFETY: this is an exact-difference check, so it is conservative - it
// never guesses. If either side is not a parseable maths expression (a
// sentence, "x = 5 (from the graph)", an unsupported function, oversize
// input, or anything rationalize()/simplify() throws on), we return null so
// the caller falls through to Tier 2 (AI) or Tier 3 (tutor) instead of
// wrongly auto-marking a correct-looking answer as wrong.

export const MAX_EXPRESSION_LENGTH = 80;

interface Reduced {
  zeroForm: string;
  isEquation: boolean;
}

function reduce(value: string): Reduced {
  const trimmed = value.trim();
  const eq = trimmed.split('=');
  if (eq.length === 1) {
    return { zeroForm: trimmed, isEquation: false };
  }
  const rhs = eq.slice(1).join('=');
  return { zeroForm: `(${eq[0]}) - (${rhs})`, isEquation: true };
}

function differenceIsZero(a: string, b: string): boolean {
  return simplify(`${rationalize(a)} - (${rationalize(b)})`).equals(parse('0'));
}

function sumIsZero(a: string, b: string): boolean {
  return simplify(`${rationalize(a)} + (${rationalize(b)})`).equals(parse('0'));
}

// Main entry: are the two answers algebraically equivalent?
// Returns true / false, or null when the input is not safely comparable
// (fall through to Tier 2/3).
export function algebraicEquivalent(
  correctAnswer: string,
  studentAnswer: string
): boolean | null {
  const ca = correctAnswer.trim();
  const sa = studentAnswer.trim();
  if (!ca || !sa) return false;
  if (ca.length > MAX_EXPRESSION_LENGTH || sa.length > MAX_EXPRESSION_LENGTH) return null;

  try {
    const c = reduce(ca);
    const s = reduce(sa);

    if (differenceIsZero(c.zeroForm, s.zeroForm)) return true;
    // Only equations also accept the negated form, so "-x - 3" never matches
    // "x + 3" (those are opposite expressions, not the same one) while
    // "3 = x" still matches "x = 3".
    if (c.isEquation && s.isEquation && sumIsZero(c.zeroForm, s.zeroForm)) return true;
    return false;
  } catch {
    return null;
  }
}
