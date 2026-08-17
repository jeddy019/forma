import { DIFFICULTY_LEVELS, type DifficultyLevel } from '@/lib/constants';

// Adaptive Difficulty (CLAUDE.md): after every scored submission,
// current_difficulty moves at most one level. Pure function, no I/O -
// Testing Strategy explicitly lists "adaptive difficulty thresholds" under
// UNIT TESTS.
//
// This is the whole-student dial as originally spec'd, not yet superseded -
// see the Adaptive Difficulty section's own forward-note: Phase 7 replaces
// this with per-sub-skill mastery once that's built, but Step 23 is built
// as written until then.
//
// Boundaries are strict: "above 80" and "below 50" per the spec text, so
// exactly 80 and exactly 50 both fall into "no change." Already-at-the-cap
// (e.g. 'higher' scoring >80, or 'foundation' scoring <50) also returns
// null - there's nowhere further to move.
export function nextDifficulty(current: DifficultyLevel, scorePercentage: number): DifficultyLevel | null {
  const index = DIFFICULTY_LEVELS.indexOf(current);

  if (scorePercentage > 80) {
    return DIFFICULTY_LEVELS[index + 1] ?? null;
  }
  if (scorePercentage < 50) {
    return DIFFICULTY_LEVELS[index - 1] ?? null;
  }
  return null;
}
