import { describe, expect, it } from 'vitest';
import { currentStreak } from '@/lib/streak/streak';

const now = new Date('2026-08-27T12:00:00Z');

describe('streak.currentStreak', () => {
  it('returns 0 with no activity', () => {
    expect(currentStreak([], now)).toBe(0);
  });

  it('counts consecutive days including today', () => {
    const days = ['2026-08-27T09:00:00Z', '2026-08-26T09:00:00Z', '2026-08-25T09:00:00Z'];
    expect(currentStreak(days, now)).toBe(3);
  });

  it('counts today + yesterday even without a longer run', () => {
    expect(currentStreak(['2026-08-27T09:00:00Z', '2026-08-26T09:00:00Z'], now)).toBe(2);
  });

  it('does not break the streak when today has no activity yet but yesterday did', () => {
    // activity on the 26th and 25th (not yet today, the 27th)
    expect(currentStreak(['2026-08-26T09:00:00Z', '2026-08-25T09:00:00Z'], now)).toBe(2);
  });

  it('resets to 0 when neither today nor yesterday had activity', () => {
    // last activity two days ago
    expect(currentStreak(['2026-08-24T09:00:00Z'], now)).toBe(0);
  });

  it('breaks the streak after a day with no activity', () => {
    // activity today and 3 days ago, but nothing in between
    const days = ['2026-08-27T09:00:00Z', '2026-08-24T09:00:00Z'];
    expect(currentStreak(days, now)).toBe(1);
  });

  it('treats multiple activities on the same day as one day', () => {
    const days = ['2026-08-27T08:00:00Z', '2026-08-27T18:00:00Z', '2026-08-26T09:00:00Z'];
    expect(currentStreak(days, now)).toBe(2);
  });

  it('handles Date objects', () => {
    const days = [new Date('2026-08-27T09:00:00Z'), new Date('2026-08-26T09:00:00Z')];
    expect(currentStreak(days, now)).toBe(2);
  });
});
