import { describe, expect, it } from 'vitest';
import { selectDailyTarget } from '@/lib/daily/dailyTarget';
import type { SkillMap } from '@/lib/mastery/types';

function entry(overrides: Partial<SkillMap[string]> = {}): SkillMap[string] {
  return {
    subSkill: 'elimination method',
    history: [{ score: 40, worksheetId: 'w1', topic: 'Simultaneous equations', at: '2026-08-19T00:00:00.000Z' }],
    mastered: false,
    masteredAt: null,
    needsFundamentals: false,
    ...overrides,
  };
}

describe('selectDailyTarget', () => {
  it('returns null with no mastery data and no worksheet history', () => {
    expect(selectDailyTarget({}, [])).toBeNull();
  });

  it('prefers RETURN TO FUNDAMENTALS above everything else', () => {
    const skillMap: SkillMap = {
      'elimination-method': entry({ needsFundamentals: true }),
      'word-problems': entry({
        subSkill: 'word problems',
        history: [{ score: 30, worksheetId: 'w2', topic: 'Simultaneous equations', at: '2026-08-20T00:00:00.000Z' }],
      }),
    };
    expect(selectDailyTarget(skillMap, [])).toEqual({
      kind: 'fundamentals',
      subSkill: 'elimination method',
      topic: 'Simultaneous equations',
    });
  });

  it('picks the weakest non-mastered sub-skill when nothing needs fundamentals', () => {
    const skillMap: SkillMap = {
      'elimination-method': entry({
        history: [{ score: 90, worksheetId: 'w1', topic: 'Simultaneous equations', at: '2026-08-18T00:00:00.000Z' }],
      }),
      'word-problems': entry({
        subSkill: 'word problems',
        history: [{ score: 55, worksheetId: 'w2', topic: 'Simultaneous equations', at: '2026-08-19T00:00:00.000Z' }],
      }),
    };
    expect(selectDailyTarget(skillMap, [])).toEqual({ kind: 'weakest', subSkill: 'word problems', topic: 'Simultaneous equations' });
  });

  it('never targets a mastered sub-skill', () => {
    const skillMap: SkillMap = {
      'elimination-method': entry({ mastered: true, masteredAt: '2026-08-01T00:00:00.000Z' }),
    };
    expect(selectDailyTarget(skillMap, [{ subject: 'Algebra', topic: 'Factorising polynomials' }])).toEqual({
      kind: 'recent',
      topic: 'Factorising polynomials',
      subject: 'Algebra',
    });
  });

  it('drops to the most recent worksheet topic when the map has no usable signal', () => {
    expect(
      selectDailyTarget({}, [
        { subject: 'Mathematics', topic: 'Percentages' },
        { subject: 'Physics', topic: 'Waves' },
      ])
    ).toEqual({ kind: 'recent', topic: 'Percentages', subject: 'Mathematics' });
  });

  it('skips recent worksheets that lack a topic', () => {
    expect(selectDailyTarget({}, [{ subject: 'Mathematics', topic: null }])).toBeNull();
  });

  it('breaks weakest ties on the most recently practised sub-skill', () => {
    const skillMap: SkillMap = {
      older: entry({
        subSkill: 'older skill',
        history: [{ score: 60, worksheetId: 'w1', topic: 'Topic A', at: '2026-08-10T00:00:00.000Z' }],
      }),
      fresher: entry({
        subSkill: 'fresher skill',
        history: [{ score: 60, worksheetId: 'w2', topic: 'Topic B', at: '2026-08-21T00:00:00.000Z' }],
      }),
    };
    expect(selectDailyTarget(skillMap, [])).toEqual({ kind: 'weakest', subSkill: 'fresher skill', topic: 'Topic B' });
  });
});