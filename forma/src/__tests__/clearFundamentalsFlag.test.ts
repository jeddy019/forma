import { describe, expect, it } from 'vitest';
import { clearFundamentalsFlag } from '@/lib/mastery/clearFundamentalsFlag';
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

describe('clearFundamentalsFlag', () => {
  it('clears needsFundamentals on the targeted sub-skill', () => {
    const skillMap: SkillMap = { 'elimination-method': entry() };
    const updated = clearFundamentalsFlag(skillMap, 'elimination method');
    expect(updated['elimination-method'].needsFundamentals).toBe(false);
  });

  it('leaves history/mastered/masteredAt untouched', () => {
    const skillMap: SkillMap = { 'elimination-method': entry({ mastered: true, masteredAt: '2026-08-18T00:00:00.000Z' }) };
    const updated = clearFundamentalsFlag(skillMap, 'elimination method');
    expect(updated['elimination-method'].mastered).toBe(true);
    expect(updated['elimination-method'].masteredAt).toBe('2026-08-18T00:00:00.000Z');
    expect(updated['elimination-method'].history).toEqual(skillMap['elimination-method'].history);
  });

  it('leaves other sub-skills untouched', () => {
    const skillMap: SkillMap = {
      'elimination-method': entry(),
      'word-problems': entry({ subSkill: 'word problems', needsFundamentals: true }),
    };
    const updated = clearFundamentalsFlag(skillMap, 'elimination method');
    expect(updated['word-problems'].needsFundamentals).toBe(true);
  });

  it('is a no-op on an unknown sub-skill', () => {
    const skillMap: SkillMap = { 'elimination-method': entry() };
    const updated = clearFundamentalsFlag(skillMap, 'a sub-skill never scored');
    expect(updated).toEqual(skillMap);
  });

  it('matches regardless of casing/whitespace differences via slugification', () => {
    const skillMap: SkillMap = { 'elimination-method': entry() };
    const updated = clearFundamentalsFlag(skillMap, '  Elimination Method  ');
    expect(updated['elimination-method'].needsFundamentals).toBe(false);
  });
});
