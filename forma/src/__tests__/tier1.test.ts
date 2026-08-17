import { describe, expect, it } from 'vitest';
import { markPart } from '@/lib/marking/tier1';

describe('markPart - numerical', () => {
  it('matches an exact number', () => {
    expect(markPart('numerical', '12', '12', 2)).toEqual({ matched: true, marks_awarded: 2 });
  });

  it('matches within the 0.01 decimal tolerance', () => {
    expect(markPart('numerical', '3', '3.01', 2)).toEqual({ matched: true, marks_awarded: 2 });
  });

  it('rejects just outside the 0.01 tolerance', () => {
    expect(markPart('numerical', '3', '3.02', 2)).toEqual({ matched: false, marks_awarded: 0 });
  });

  it('matches a negative number', () => {
    expect(markPart('numerical', '-4', '-4', 2)).toEqual({ matched: true, marks_awarded: 2 });
  });

  it('falls back to string comparison for non-numeric answers like fractions', () => {
    expect(markPart('numerical', '3/4', '3/4', 2)).toEqual({ matched: true, marks_awarded: 2 });
    expect(markPart('numerical', '3/4', '4/5', 2)).toEqual({ matched: false, marks_awarded: 0 });
  });

  it('treats a blank student answer as wrong, not zero', () => {
    expect(markPart('numerical', '0', '', 2)).toEqual({ matched: false, marks_awarded: 0 });
  });
});

describe('markPart - coordinates', () => {
  it('matches after normalising whitespace and case', () => {
    expect(markPart('coordinates', '(3, 4)', '(3,4)', 3)).toEqual({ matched: true, marks_awarded: 3 });
    expect(markPart('coordinates', '(3, 4)', ' (3,  4) ', 3)).toEqual({ matched: true, marks_awarded: 3 });
  });

  it('rejects a different coordinate', () => {
    expect(markPart('coordinates', '(3, 4)', '(4, 3)', 3)).toEqual({ matched: false, marks_awarded: 0 });
  });
});

describe('markPart - true_false', () => {
  it('matches regardless of case', () => {
    expect(markPart('true_false', 'True', 'true', 1)).toEqual({ matched: true, marks_awarded: 1 });
    expect(markPart('true_false', 'False', 'FALSE', 1)).toEqual({ matched: true, marks_awarded: 1 });
  });

  it('rejects the wrong value', () => {
    expect(markPart('true_false', 'True', 'False', 1)).toEqual({ matched: false, marks_awarded: 0 });
  });
});

describe('markPart - multiple_choice', () => {
  it('matches the correct option regardless of case and surrounding whitespace', () => {
    expect(markPart('multiple_choice', 'B', ' b ', 1)).toEqual({ matched: true, marks_awarded: 1 });
  });

  it('rejects an incorrect option', () => {
    expect(markPart('multiple_choice', 'B', 'C', 1)).toEqual({ matched: false, marks_awarded: 0 });
  });
});

describe('markPart - extended', () => {
  it('returns null so the caller routes it to Tier 2 or 3', () => {
    expect(markPart('extended', 'any working shown', 'student working', 4)).toBeNull();
  });
});
