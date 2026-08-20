import { describe, expect, it } from 'vitest';
import { accumulateBySubSkill } from '@/lib/mastery/accumulateBySubSkill';

describe('accumulateBySubSkill', () => {
  it('groups entries by sub-skill and sums marks', () => {
    const result = accumulateBySubSkill([
      { subSkill: 'elimination method', marksAwarded: 2, marksAvailable: 2 },
      { subSkill: 'elimination method', marksAwarded: 1, marksAvailable: 2 },
      { subSkill: 'word problems', marksAwarded: 3, marksAvailable: 3 },
    ]);

    expect(result['elimination-method']).toEqual({ label: 'elimination method', awarded: 3, available: 4 });
    expect(result['word-problems']).toEqual({ label: 'word problems', awarded: 3, available: 3 });
  });

  it('skips entries with an empty or missing subSkill without throwing', () => {
    const result = accumulateBySubSkill([
      { subSkill: '', marksAwarded: 1, marksAvailable: 2 },
      { subSkill: null, marksAwarded: 1, marksAvailable: 2 },
      { subSkill: undefined, marksAwarded: 1, marksAvailable: 2 },
      { subSkill: '   ', marksAwarded: 1, marksAvailable: 2 },
      { subSkill: 'word problems', marksAwarded: 2, marksAvailable: 2 },
    ]);

    expect(Object.keys(result)).toEqual(['word-problems']);
  });

  it('merges differently-cased same names into one entry', () => {
    const result = accumulateBySubSkill([
      { subSkill: 'Elimination Method', marksAwarded: 2, marksAvailable: 2 },
      { subSkill: 'elimination method', marksAwarded: 1, marksAvailable: 1 },
    ]);

    expect(Object.keys(result)).toEqual(['elimination-method']);
    expect(result['elimination-method']).toEqual({ label: 'Elimination Method', awarded: 3, available: 3 });
  });

  it('returns an empty object for an empty input array', () => {
    expect(accumulateBySubSkill([])).toEqual({});
  });
});
