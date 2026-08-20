import { describe, expect, it } from 'vitest';
import { selectFundamentalsTarget } from '@/lib/mastery/selectFundamentalsTarget';
import type { SkillMap } from '@/lib/mastery/types';

function entry(overrides: Partial<SkillMap[string]> = {}): SkillMap[string] {
  return {
    subSkill: 'elimination method',
    history: [{ score: 40, worksheetId: 'w1', topic: 'Simultaneous equations', at: '2026-08-19T00:00:00.000Z' }],
    mastered: false,
    masteredAt: null,
    needsFundamentals: true,
    ...overrides,
  };
}

describe('selectFundamentalsTarget', () => {
  it('returns null when nothing is flagged', () => {
    const skillMap: SkillMap = { 'elimination-method': entry({ needsFundamentals: false }) };
    expect(selectFundamentalsTarget(skillMap)).toBeNull();
  });

  it('returns null for an empty skill_map', () => {
    expect(selectFundamentalsTarget({})).toBeNull();
  });

  it('returns the flagged sub-skill and its most recent topic', () => {
    const skillMap: SkillMap = { 'elimination-method': entry() };
    expect(selectFundamentalsTarget(skillMap)).toEqual({ subSkill: 'elimination method', topic: 'Simultaneous equations' });
  });

  it('ignores mastered or non-flagged entries', () => {
    const skillMap: SkillMap = {
      'elimination-method': entry({ needsFundamentals: false, mastered: true }),
      'word-problems': entry({ subSkill: 'word problems', needsFundamentals: false }),
    };
    expect(selectFundamentalsTarget(skillMap)).toBeNull();
  });

  it('picks the most-recently-flagged sub-skill when multiple are flagged', () => {
    const skillMap: SkillMap = {
      'elimination-method': entry({
        history: [{ score: 40, worksheetId: 'w1', topic: 'Simultaneous equations', at: '2026-08-17T00:00:00.000Z' }],
      }),
      'word-problems': entry({
        subSkill: 'word problems',
        history: [{ score: 30, worksheetId: 'w2', topic: 'Simultaneous equations', at: '2026-08-19T00:00:00.000Z' }],
      }),
    };
    expect(selectFundamentalsTarget(skillMap)).toEqual({ subSkill: 'word problems', topic: 'Simultaneous equations' });
  });
});
