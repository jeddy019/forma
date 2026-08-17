import { describe, expect, it } from 'vitest';
import { computeSpeedFlag } from '@/lib/marking/speedAwareness';

describe('computeSpeedFlag', () => {
  it('is not slow when timeTakenSeconds is null (no first_opened_at captured)', () => {
    expect(computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: null, scorePercentage: 90 }, [])).toEqual({
      isSlow: false,
      averageSeconds: null,
    });
  });

  it('is not slow when scorePercentage is null (not yet reviewed)', () => {
    expect(computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: 3000, scorePercentage: null }, [])).toEqual({
      isSlow: false,
      averageSeconds: null,
    });
  });

  it('is not slow when the score is below the correct threshold', () => {
    const peers = [{ worksheetId: 'w2', timeTakenSeconds: 300 }];
    expect(computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: 3000, scorePercentage: 60 }, peers).isSlow).toBe(false);
  });

  it('is not slow when there are no comparable peers', () => {
    expect(computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: 3000, scorePercentage: 90 }, []).isSlow).toBe(false);
  });

  it('flags as slow when correct and well above the peer average', () => {
    const peers = [
      { worksheetId: 'w2', timeTakenSeconds: 600 },
      { worksheetId: 'w3', timeTakenSeconds: 400 },
    ]; // average 500, threshold 750
    const result = computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: 900, scorePercentage: 80 }, peers);
    expect(result).toEqual({ isSlow: true, averageSeconds: 500 });
  });

  it('does not flag when correct but only modestly above average', () => {
    const peers = [{ worksheetId: 'w2', timeTakenSeconds: 600 }];
    const result = computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: 700, scorePercentage: 80 }, peers);
    expect(result.isSlow).toBe(false);
  });

  it('excludes the target worksheet itself from its own peer average', () => {
    const peers = [{ worksheetId: 'w1', timeTakenSeconds: 999999 }];
    expect(computeSpeedFlag({ worksheetId: 'w1', timeTakenSeconds: 900, scorePercentage: 80 }, peers)).toEqual({
      isSlow: false,
      averageSeconds: null,
    });
  });
});
