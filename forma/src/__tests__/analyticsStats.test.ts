import { describe, expect, it } from 'vitest';
import {
  computeCompletionStats,
  computeTimeStats,
  computeTopicStats,
  type AnalyticsWorksheetRow,
  type AnalyticsSubmissionRow,
} from '@/lib/analytics/stats';

const ws = (id: string, first_opened_at: string | null): AnalyticsWorksheetRow => ({
  id,
  first_opened_at,
  subject: 'Mathematics',
  topic: 'Fractions',
});

const sub = (worksheet_id: string, submitted_at: string, score: number | null, reviewed = false): AnalyticsSubmissionRow => ({
  worksheet_id,
  score_percentage: score,
  submitted_at,
  tutor_marks_json: reviewed ? { q1: {} } : null,
});

describe('computeCompletionStats', () => {
  it('returns zeros / nulls when there are no worksheets', () => {
    expect(computeCompletionStats([], [])).toEqual({
      total: 0,
      opened: 0,
      submitted: 0,
      reviewed: 0,
      completionRate: null,
      averageScore: null,
    });
  });

  it('counts opened, submitted and reviewed independently', () => {
    const worksheets = [ws('w1', '2026-08-28T09:00:00Z'), ws('w2', null), ws('w3', '2026-08-28T10:00:00Z')];
    const submissions = [sub('w1', '2026-08-28T09:30:00Z', 80, true), sub('w3', '2026-08-28T11:00:00Z', 60, false)];
    const stats = computeCompletionStats(worksheets, submissions);
    expect(stats.total).toBe(3);
    expect(stats.opened).toBe(2);
    expect(stats.submitted).toBe(2);
    expect(stats.reviewed).toBe(1);
    expect(stats.completionRate).toBe(Math.round((2 / 3) * 100));
    expect(stats.averageScore).toBe(70);
  });

  it('returns null completion rate when nothing submitted', () => {
    const stats = computeCompletionStats([ws('w1', '2026-08-28T09:00:00Z')], []);
    expect(stats.completionRate).toBeNull();
    expect(stats.averageScore).toBeNull();
  });

  it('counts every submission handed in within the set', () => {
    const stats = computeCompletionStats([ws('w1', null)], [sub('w1', '2026-08-28T09:00:00Z', 90)]);
    expect(stats.submitted).toBe(1);
    expect(stats.completionRate).toBe(100);
    expect(stats.averageScore).toBe(90);
  });
});

describe('computeTimeStats', () => {
  it('returns nulls with no usable pairs', () => {
    expect(computeTimeStats([], [])).toEqual({ averageMinutes: null, slowestMinutes: null, sampleSize: 0 });
    // Worksheet opened but no submission: still no pair.
    expect(computeTimeStats([ws('w1', '2026-08-28T09:00:00Z')], [])).toEqual({
      averageMinutes: null,
      slowestMinutes: null,
      sampleSize: 0,
    });
  });

  it('averages minutes from first open to submission and reports the slowest', () => {
    const worksheets = [ws('w1', '2026-08-28T09:00:00Z'), ws('w2', '2026-08-28T09:00:00Z')];
    const submissions = [
      sub('w1', '2026-08-28T09:30:00Z', 80), // 30 minutes
      sub('w2', '2026-08-28T11:00:00Z', 60), // 120 minutes
    ];
    const stats = computeTimeStats(worksheets, submissions);
    expect(stats.sampleSize).toBe(2);
    expect(stats.averageMinutes).toBe(75);
    expect(stats.slowestMinutes).toBe(120);
  });

  it('drops a submission with no open timestamp', () => {
    const stats = computeTimeStats([ws('w1', null)], [sub('w1', '2026-08-28T09:30:00Z', 80)]);
    expect(stats.sampleSize).toBe(0);
    expect(stats.averageMinutes).toBeNull();
  });
});

describe('computeTopicStats', () => {
  it('aggregates by subject + topic and averages scores', () => {
    const worksheets = [
      { ...ws('w1', null), topic: 'Fractions' },
      { ...ws('w2', null), topic: 'Fractions' },
      { ...ws('w3', null), subject: 'Biology', topic: 'Cells' },
    ];
    const submissions = [
      sub('w1', '2026-08-28T09:30:00Z', 70),
      sub('w2', '2026-08-28T10:30:00Z', 90),
      sub('w3', '2026-08-28T11:30:00Z', 50),
    ];
    const stats = computeTopicStats(worksheets, submissions);
    const fractions = stats.find((s) => s.topic === 'Fractions');
    const cells = stats.find((s) => s.topic === 'Cells');
    expect(fractions?.submitted).toBe(2);
    expect(fractions?.averageScore).toBe(80);
    expect(cells?.submitted).toBe(1);
    expect(cells?.averageScore).toBe(50);
    // Sorted by subject then topic: Biology first.
    expect(stats[0].subject).toBe('Biology');
  });

  it('returns an empty array with no worksheets', () => {
    expect(computeTopicStats([], [])).toEqual([]);
  });
});
