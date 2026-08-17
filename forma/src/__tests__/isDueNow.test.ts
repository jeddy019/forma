import { describe, expect, it } from 'vitest';
import { isDueNow, type DueCheckInput } from '@/lib/schedule/isDueNow';

// Wednesday 2026-08-19 16:00 BST (Europe/London, UTC+1 in August) = 15:00 UTC.
const WEDNESDAY_4PM_LONDON_UTC = new Date('2026-08-19T15:00:00.000Z');

const base: DueCheckInput = {
  dayOfWeek: 3, // Wednesday
  deliveryHour: 16,
  deliveryTimezone: 'Europe/London',
  lastGeneratedAt: null,
};

describe('isDueNow', () => {
  it('is due when the day and hour match in the schedule timezone, never generated before', () => {
    expect(isDueNow(base, WEDNESDAY_4PM_LONDON_UTC)).toBe(true);
  });

  it('is not due when the day does not match', () => {
    expect(isDueNow({ ...base, dayOfWeek: 4 }, WEDNESDAY_4PM_LONDON_UTC)).toBe(false);
  });

  it('is not due when the hour does not match', () => {
    expect(isDueNow({ ...base, deliveryHour: 17 }, WEDNESDAY_4PM_LONDON_UTC)).toBe(false);
  });

  it('converts correctly for a non-UTC, non-London timezone', () => {
    // Same instant is 07:00 in America/Los_Angeles (UTC-8 in August... wait,
    // August is PDT, UTC-7) - 15:00 UTC - 7h = 08:00 Wednesday LA time.
    const laSchedule: DueCheckInput = { ...base, deliveryHour: 8, deliveryTimezone: 'America/Los_Angeles' };
    expect(isDueNow(laSchedule, WEDNESDAY_4PM_LONDON_UTC)).toBe(true);
  });

  it('is due when last_generated_at is null, regardless of history', () => {
    expect(isDueNow({ ...base, lastGeneratedAt: null }, WEDNESDAY_4PM_LONDON_UTC)).toBe(true);
  });

  it('is not due when last generated fewer than 6 days ago', () => {
    const threeDaysAgo = new Date(WEDNESDAY_4PM_LONDON_UTC.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDueNow({ ...base, lastGeneratedAt: threeDaysAgo }, WEDNESDAY_4PM_LONDON_UTC)).toBe(false);
  });

  it('is due when last generated more than 6 days ago', () => {
    const eightDaysAgo = new Date(WEDNESDAY_4PM_LONDON_UTC.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDueNow({ ...base, lastGeneratedAt: eightDaysAgo }, WEDNESDAY_4PM_LONDON_UTC)).toBe(true);
  });

  it('is due at exactly 6 days (the check is "fewer than 6 days" excludes, not "6 or fewer")', () => {
    const exactlySixDaysAgo = new Date(WEDNESDAY_4PM_LONDON_UTC.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDueNow({ ...base, lastGeneratedAt: exactlySixDaysAgo }, WEDNESDAY_4PM_LONDON_UTC)).toBe(true);
  });
});
