import { describe, expect, it } from 'vitest';
import {
  currentStreak,
  currentStreakWithFreeze,
  splitFrozenDays,
  joinFrozenDays,
  appendFrozenDay,
  freezeMonth,
} from '@/lib/streak/streak';

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

describe('streak.currentStreakWithFreeze (W5 B78)', () => {
  it('returns the plain streak untouched when it is already alive', () => {
    const days = ['2026-08-27T09:00:00Z', '2026-08-26T09:00:00Z', '2026-08-25T09:00:00Z'];
    expect(currentStreakWithFreeze(days, [], now)).toEqual({ streak: 3, dayToFreeze: null });
  });

  it('does not burn a freeze while today is simply not practised yet', () => {
    // Activity on the 26th and 25th; today (the 27th) is empty but that is
    // normal - streak counts from yesterday.
    const days = ['2026-08-26T09:00:00Z', '2026-08-25T09:00:00Z'];
    expect(currentStreakWithFreeze(days, [], now)).toEqual({ streak: 2, dayToFreeze: null });
  });

  it('bridges exactly one missed day when a freeze is available', () => {
    // Activity on the 25th and 24th; the 26th (yesterday) is the single
    // missed day before the grace start. Bridging it keeps the streak at 3
    // (26 bridged + 25 + 24).
    const days = ['2026-08-25T09:00:00Z', '2026-08-24T09:00:00Z'];
    expect(currentStreakWithFreeze(days, [], now)).toEqual({ streak: 3, dayToFreeze: '2026-08-26' });
  });

  it('flags the bridged day for persistence when one freeze was used', () => {
    const days = ['2026-08-25T09:00:00Z', '2026-08-24T09:00:00Z'];
    const outcome = currentStreakWithFreeze(days, [], now);
    expect(outcome.dayToFreeze).toBe('2026-08-26');
  });

  it('keeps the bridged streak alive on reload once the day is frozen (idempotent)', () => {
    const days = ['2026-08-25T09:00:00Z', '2026-08-24T09:00:00Z'];
    const outcome = currentStreakWithFreeze(days, [], now);
    expect(outcome.dayToFreeze).not.toBeNull();
    const frozenDays = appendFrozenDay([], outcome.dayToFreeze as string);
    const reload = currentStreakWithFreeze(days, frozenDays, now);
    expect(reload).toEqual({ streak: 3, dayToFreeze: null });
  });

  it('does not rescue a break of more than one day', () => {
    // Last activity on the 23rd - the hole spans 24th, 25th, 26th.
    const days = ['2026-08-23T09:00:00Z'];
    expect(currentStreakWithFreeze(days, [], now)).toEqual({ streak: 0, dayToFreeze: null });
  });

  it('spends at most one freeze per calendar month', () => {
    const days = ['2026-08-25T09:00:00Z', '2026-08-24T09:00:00Z'];
    // An earlier freeze this month (say on the 2nd) is already on record.
    const frozenDays = ['2026-08-02'];
    expect(currentStreakWithFreeze(days, frozenDays, now)).toEqual({ streak: 0, dayToFreeze: null });
  });

  it('lets a new month spend its own freeze', () => {
    // now is 2 Sep; yesterday is 1 Sep (the missed day), the day before that
    // (31 Aug) was active. An August freeze is on record but the missed day
    // is September, so the new month's freeze is available.
    const nowSept2 = new Date('2026-09-02T12:00:00Z');
    const days = ['2026-08-31T09:00:00Z', '2026-08-30T09:00:00Z'];
    const frozenAugust = ['2026-08-02'];
    expect(currentStreakWithFreeze(days, frozenAugust, nowSept2)).toEqual({
      streak: 3,
      dayToFreeze: '2026-09-01',
    });
  });

  it('treats an already-frozen day as an active day forever', () => {
    // now is Aug 26; the 25th was frozen earlier. With activity on the 24th
    // and 23rd, the run 25, 24, 23 stays intact because the frozen 25th is
    // yesterday and counts.
    const nowAug26 = new Date('2026-08-26T12:00:00Z');
    const days = ['2026-08-24T09:00:00Z', '2026-08-23T09:00:00Z'];
    const frozenDays = ['2026-08-25'];
    expect(currentStreakWithFreeze(days, frozenDays, nowAug26)).toEqual({ streak: 3, dayToFreeze: null });
  });
});

describe('streak.frozen-day storage helpers (W5 B78)', () => {
  it('parses an empty or null list as no frozen days', () => {
    expect(splitFrozenDays('')).toEqual([]);
    expect(splitFrozenDays(null)).toEqual([]);
    expect(splitFrozenDays(undefined)).toEqual([]);
  });

  it('round-trips a comma-separated list', () => {
    const days = ['2026-08-25', '2026-08-26'];
    expect(splitFrozenDays(joinFrozenDays(days))).toEqual(days);
  });

  it('appends without duplicating and keeps order', () => {
    expect(appendFrozenDay(['2026-08-25'], '2026-08-24')).toEqual(['2026-08-24', '2026-08-25']);
    expect(appendFrozenDay(['2026-08-25'], '2026-08-25')).toEqual(['2026-08-25']);
  });

  it('derives the month from a UTC day label', () => {
    expect(freezeMonth('2026-08-26')).toBe('2026-08');
  });
});
