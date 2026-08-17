import { describe, expect, it } from 'vitest';
import { computeWeeklySummary } from '@/lib/summary/weeklySummary';

describe('computeWeeklySummary', () => {
  it('returns an all-null/zero summary for no submissions', () => {
    expect(computeWeeklySummary([])).toEqual({
      worksheetsCompleted: 0,
      averageScorePercentage: null,
      strongestTopic: null,
      areaToImprove: null,
    });
  });

  it('a single submission is both the strongest and the area to improve', () => {
    const result = computeWeeklySummary([{ scorePercentage: 70, topic: 'Fractions' }]);
    expect(result.worksheetsCompleted).toBe(1);
    expect(result.averageScorePercentage).toBe(70);
    expect(result.strongestTopic).toBe('Fractions');
    expect(result.areaToImprove).toBe('Fractions');
  });

  it('identifies the highest and lowest scoring topics across multiple submissions', () => {
    const result = computeWeeklySummary([
      { scorePercentage: 90, topic: 'Fractions' },
      { scorePercentage: 40, topic: 'Long division' },
      { scorePercentage: 70, topic: 'Ratio' },
    ]);
    expect(result.worksheetsCompleted).toBe(3);
    expect(result.strongestTopic).toBe('Fractions');
    expect(result.areaToImprove).toBe('Long division');
  });

  it('rounds the average score to the nearest whole number', () => {
    const result = computeWeeklySummary([
      { scorePercentage: 70, topic: 'A' },
      { scorePercentage: 71, topic: 'B' },
    ]);
    expect(result.averageScorePercentage).toBe(71); // 70.5 rounds up
  });
});
