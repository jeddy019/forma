// W8 Wave D (automatic daily quiz): resolves a student's founder-side dials
// into the concrete daily plan (question count + a difficulty sentence to
// fold into the generation topic text). Pure - no I/O - trivially testable.
//
// DAILY QUIZ rules from CLAUDE.md:
//   - Length by difficulty, never easy-tier: higher difficulty -> 5
//     questions, moderate/foundation -> 10. That is the STANDARD volume;
//     Light is always 5, Deep is always 15.
//   - Volume dial: Light (5) / Standard / Deep (15) per day.
//   - Difficulty posture: Match / Push one tier / Consolidate-mastery.
//   - Holiday posture: Normal / Light (5 moderate questions, no push) /
//     Paused (skip entirely). Manual only - no country term-date
//     auto-detection is faked.
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '@/lib/constants';

export const PRACTICE_VOLUMES = ['light', 'standard', 'deep'] as const;
export type PracticeVolume = (typeof PRACTICE_VOLUMES)[number];

export const DIFFICULTY_POSTURES = ['match', 'push', 'consolidate'] as const;
export type DifficultyPosture = (typeof DIFFICULTY_POSTURES)[number];

export const HOLIDAY_POSTURES = ['normal', 'light', 'paused'] as const;
export type HolidayPosture = (typeof HOLIDAY_POSTURES)[number];

export interface DailyDialPlan {
  questionCount: 5 | 10 | 15;
  // A difficulty sentence appended to the topic text (mirroring how the
  // generate-scheduled cron folds its stored difficulty into the topic line,
  // since buildUserPrompt has no dedicated difficulty parameter). Empty when
  // no targeted guidance is useful.
  difficultyDirective: string;
  // True when the holiday 'light' posture applied (5 moderate, no push even
  // when the daily posture says push).
  holiday: boolean;
}

function tierIndex(current: DifficultyLevel): number {
  return DIFFICULTY_LEVELS.indexOf(current);
}

// "moderate" in the holiday-light sense = at their level, never pushed
// harder - the same outcome as the match posture, so a single directive
// covers both.
function matchDirective(current: DifficultyLevel | null): string {
  return current === 'foundation' || current === 'higher' ? `Target difficulty: ${current}.` : '';
}

export function resolveDailyPlan(input: {
  practiceVolume: PracticeVolume;
  difficultyPosture: DifficultyPosture;
  holidayPosture: HolidayPosture;
  currentDifficulty: DifficultyLevel | null;
}): DailyDialPlan | null {
  // Paused for holidays: nothing is auto-generated until it flips back.
  if (input.holidayPosture === 'paused') return null;

  const current = input.currentDifficulty ?? 'standard';

  const baseCount: 5 | 10 | 15 =
    input.practiceVolume === 'light'
      ? 5
      : input.practiceVolume === 'deep'
        ? 15
        : // Standard volume: higher-tier students get a shorter, sharper set
          // rather than a longer gentler one.
          current === 'higher'
          ? 5
          : 10;

  // Holiday light: always 5 moderate questions, no push.
  if (input.holidayPosture === 'light') {
    return {
      questionCount: 5,
      difficultyDirective: matchDirective(current),
      holiday: true,
    };
  }

  const index = tierIndex(current);

  switch (input.difficultyPosture) {
    case 'match':
      return { questionCount: baseCount, difficultyDirective: matchDirective(current), holiday: false };
    case 'push': {
      // Already at the cap - a push would be meaningless, fall back to match.
      const pushed = index < DIFFICULTY_LEVELS.length - 1 ? DIFFICULTY_LEVELS[index + 1] : null;
      return {
        questionCount: baseCount,
        difficultyDirective: pushed
          ? `Target difficulty: ${pushed} - one tier above the student's usual ${current} level, a deliberate push.`
          : matchDirective(current),
        holiday: false,
      };
    }
    case 'consolidate':
      return {
        questionCount: baseCount,
        difficultyDirective:
          'Consolidation mode: reinforce already-learned material at the student\'s current level rather than introducing harder content.',
        holiday: false,
      };
  }
}