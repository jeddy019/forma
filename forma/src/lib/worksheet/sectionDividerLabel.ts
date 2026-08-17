// Shared by worksheet-template.ts (PDF) and the /s/[code] student page - one
// definition of where "Warm-up" and "Challenge" dividers land, so the two
// surfaces can't silently disagree on section boundaries. "Warm-up" appears
// once, immediately before Q1; "Challenge" appears once, immediately before
// the first challenge question. Core questions get no divider.
export function sectionDividerLabel<T extends { type: string }>(
  question: T,
  index: number,
  questions: T[]
): 'Warm-up' | 'Challenge' | null {
  const prevType = index > 0 ? questions[index - 1].type : null;
  if (question.type === 'warm-up' && prevType === null) return 'Warm-up';
  if (question.type === 'challenge' && prevType !== 'challenge') return 'Challenge';
  return null;
}
