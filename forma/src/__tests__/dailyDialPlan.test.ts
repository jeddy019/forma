import { describe, expect, it } from 'vitest';
import { resolveDailyPlan } from '@/lib/daily/dailyDialPlan';

// Defaults from the migration: practice_volume 'standard', difficulty_posture
// 'match', holiday_posture 'light' (the CLAUDE.md default advice for a
// school break is Light, keep it as the schema default).
describe('resolveDailyPlan', () => {
  it('returns null when holiday posture is paused (nothing is generated)', () => {
    expect(
      resolveDailyPlan({
        practiceVolume: 'standard',
        difficultyPosture: 'match',
        holidayPosture: 'paused',
        currentDifficulty: 'standard',
      })
    ).toBeNull();
  });

  it('holiday light forces 5 moderate questions and never pushes even when posture is push', () => {
    const plan = resolveDailyPlan({
      practiceVolume: 'deep',
      difficultyPosture: 'push',
      holidayPosture: 'light',
      currentDifficulty: 'standard',
    });
    expect(plan).not.toBeNull();
    expect(plan?.questionCount).toBe(5);
    expect(plan?.holiday).toBe(true);
    expect(plan?.difficultyDirective).not.toContain('push');
    expect(plan?.difficultyDirective).not.toContain('higher');
  });

  it('volume light is 5 questions', () => {
    const plan = resolveDailyPlan({
      practiceVolume: 'light',
      difficultyPosture: 'match',
      holidayPosture: 'normal',
      currentDifficulty: 'standard',
    });
    expect(plan?.questionCount).toBe(5);
  });

  it('volume deep is 15 questions', () => {
    const plan = resolveDailyPlan({
      practiceVolume: 'deep',
      difficultyPosture: 'match',
      holidayPosture: 'normal',
      currentDifficulty: 'standard',
    });
    expect(plan?.questionCount).toBe(15);
  });

  it('volume standard is 10 for foundation and standard tiers', () => {
    for (const current of ['foundation', 'standard'] as const) {
      const plan = resolveDailyPlan({
        practiceVolume: 'standard',
        difficultyPosture: 'match',
        holidayPosture: 'normal',
        currentDifficulty: current,
      });
      expect(plan?.questionCount).toBe(10);
    }
  });

  it('volume standard is 5 for a higher-tier student (length by difficulty)', () => {
    const plan = resolveDailyPlan({
      practiceVolume: 'standard',
      difficultyPosture: 'match',
      holidayPosture: 'normal',
      currentDifficulty: 'higher',
    });
    expect(plan?.questionCount).toBe(5);
  });

  it('match emits an explicit directive only for a genuinely moved tier', () => {
    expect(
      resolveDailyPlan({
        practiceVolume: 'standard',
        difficultyPosture: 'match',
        holidayPosture: 'normal',
        currentDifficulty: 'higher',
      })?.difficultyDirective
    ).toBe('Target difficulty: higher.');
    expect(
      resolveDailyPlan({
        practiceVolume: 'standard',
        difficultyPosture: 'match',
        holidayPosture: 'normal',
        currentDifficulty: 'standard',
      })?.difficultyDirective
    ).toBe('');
  });

  it('push emits a one-tier-above directive and stays silent at the cap', () => {
    const pushed = resolveDailyPlan({
      practiceVolume: 'standard',
      difficultyPosture: 'push',
      holidayPosture: 'normal',
      currentDifficulty: 'standard',
    });
    expect(pushed?.difficultyDirective).toContain('higher');
    expect(pushed?.difficultyDirective).toContain('one tier above');

    const capped = resolveDailyPlan({
      practiceVolume: 'standard',
      difficultyPosture: 'push',
      holidayPosture: 'normal',
      currentDifficulty: 'higher',
    });
    expect(capped?.difficultyDirective).toBe('Target difficulty: higher.');
  });

  it('consolidate reinforces rather than pushes', () => {
    const plan = resolveDailyPlan({
      practiceVolume: 'standard',
      difficultyPosture: 'consolidate',
      holidayPosture: 'normal',
      currentDifficulty: 'foundation',
    });
    expect(plan?.difficultyDirective).toContain('Consolidation mode');
    expect(plan?.questionCount).toBe(10);
  });
});