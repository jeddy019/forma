import { describe, expect, it } from 'vitest';
import {
  REVIEW_INTERVALS,
  initialReview,
  scheduleNextReview,
  isDue,
  dueReviews,
  nextDueLabel,
  type ReviewEntry,
} from '@/lib/srs/engine';

const now = new Date('2026-08-27T12:00:00Z');

function seed() {
  return { studentId: 's1', subSkill: 'elimination-method', subSkillLabel: 'Elimination method', topic: 'Equations' };
}

describe('srs.initialReview', () => {
  it('starts at the first rung, due one day out', () => {
    const r = initialReview(seed(), now);
    expect(r.intervalDays).toBe(1);
    expect(r.ladderStep).toBe(0);
    expect(r.nextReviewAt).toBe(new Date('2026-08-28T12:00:00Z').toISOString());
    expect(r.lastReviewedAt).toBeNull();
  });
});

describe('srs.scheduleNextReview', () => {
  it('advances up the 1/3/7/14/30 ladder on pass', () => {
    const base = initialReview(seed(), now);
    const steps = [3, 7, 14, 30, 30];
    let entry = base;
    for (const expectInterval of steps) {
      entry = scheduleNextReview(entry, true, now);
      expect(entry.intervalDays).toBe(expectInterval);
    }
    // capped at the top rung
    entry = scheduleNextReview(entry, true, now);
    expect(entry.intervalDays).toBe(30);
    expect(entry.ladderStep).toBe(REVIEW_INTERVALS.length - 1);
  });

  it('schedules the next review at now + interval days', () => {
    const base = initialReview(seed(), now);
    const after = scheduleNextReview(base, true, now);
    expect(after.nextReviewAt).toBe(new Date('2026-08-30T12:00:00Z').toISOString()); // 3 days
  });

  it('resets to day 1 on fail regardless of current rung', () => {
    let entry = initialReview(seed(), now);
    entry = scheduleNextReview(entry, true, now); // → 3
    entry = scheduleNextReview(entry, true, now); // → 7
    entry = scheduleNextReview(entry, false, now); // fail
    expect(entry.intervalDays).toBe(1);
    expect(entry.ladderStep).toBe(0);
    expect(entry.nextReviewAt).toBe(new Date('2026-08-28T12:00:00Z').toISOString());
  });

  it('sets lastReviewedAt on both pass and fail', () => {
    const base = initialReview(seed(), now);
    expect(scheduleNextReview(base, true, now).lastReviewedAt).toBe(now.toISOString());
    expect(scheduleNextReview(base, false, now).lastReviewedAt).toBe(now.toISOString());
  });
});

describe('srs.isDue / dueReviews', () => {
  function mk(daysFromNow: number, id: string): ReviewEntry {
    const d = new Date(now.getTime());
    d.setUTCDate(d.getUTCDate() + daysFromNow);
    return { ...seed(), subSkill: id, nextReviewAt: d.toISOString(), intervalDays: 1, ladderStep: 0, lastReviewedAt: null };
  }

  it('is due at/after the scheduled time', () => {
    expect(isDue(mk(0, 'a'), now)).toBe(true);
    expect(isDue(mk(-1, 'b'), now)).toBe(true);
    expect(isDue(mk(1, 'c'), now)).toBe(false);
  });

  it('dueReviews returns only those at/overdue', () => {
    const entries = [mk(0, 'due-now'), mk(-2, 'overdue'), mk(5, 'future')];
    const due = dueReviews(entries, now).map((e) => e.subSkill);
    expect(due).toEqual(['due-now', 'overdue']);
  });

  it('nextDueLabel handles due, tomorrow, and later', () => {
    expect(nextDueLabel(mk(0, 'a'), now)).toBe('due now');
    expect(nextDueLabel(mk(1, 'b'), now)).toBe('tomorrow');
    expect(nextDueLabel(mk(3, 'c'), now)).toBe('in 3 days');
  });
});
