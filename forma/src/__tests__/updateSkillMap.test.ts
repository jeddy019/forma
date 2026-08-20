import { describe, expect, it } from 'vitest';
import { updateSkillMap } from '@/lib/mastery/updateSkillMap';
import type { SkillMap } from '@/lib/mastery/types';

function score(subSkill: string, scorePercentage: number, worksheetId = 'w1', topic = 'Simultaneous equations', at = '2026-08-19T00:00:00.000Z') {
  return { subSkill, topic, scorePercentage, worksheetId, at };
}

describe('updateSkillMap', () => {
  it('masters a sub-skill after two consecutive scores at or above 85%', () => {
    let map: SkillMap = {};
    map = updateSkillMap(map, [score('elimination method', 90, 'w1')]);
    expect(map['elimination-method'].mastered).toBe(false);
    map = updateSkillMap(map, [score('elimination method', 85, 'w2')]);
    expect(map['elimination-method'].mastered).toBe(true);
    expect(map['elimination-method'].masteredAt).not.toBeNull();
  });

  it('does not master on one high, one low score', () => {
    let map: SkillMap = {};
    map = updateSkillMap(map, [score('elimination method', 90, 'w1')]);
    map = updateSkillMap(map, [score('elimination method', 60, 'w2')]);
    expect(map['elimination-method'].mastered).toBe(false);
  });

  it('still counts as consecutive when a different sub-skill is scored in between', () => {
    let map: SkillMap = {};
    map = updateSkillMap(map, [score('elimination method', 90, 'w1')]);
    map = updateSkillMap(map, [score('word problems', 40, 'w2')]);
    map = updateSkillMap(map, [score('elimination method', 88, 'w3')]);
    expect(map['elimination-method'].mastered).toBe(true);
    expect(map['word-problems'].mastered).toBe(false);
  });

  it('mastery is sticky after a later low score', () => {
    let map: SkillMap = {};
    map = updateSkillMap(map, [score('elimination method', 90, 'w1')]);
    map = updateSkillMap(map, [score('elimination method', 90, 'w2')]);
    expect(map['elimination-method'].mastered).toBe(true);
    map = updateSkillMap(map, [score('elimination method', 20, 'w3')]);
    expect(map['elimination-method'].mastered).toBe(true);
  });

  it('needsFundamentals reflects only the latest score, not history', () => {
    let map: SkillMap = {};
    map = updateSkillMap(map, [score('elimination method', 30, 'w1')]);
    expect(map['elimination-method'].needsFundamentals).toBe(true);
    map = updateSkillMap(map, [score('elimination method', 90, 'w2')]);
    expect(map['elimination-method'].needsFundamentals).toBe(false);
  });

  it('needsFundamentals is false at and above the 50% boundary', () => {
    let map: SkillMap = {};
    map = updateSkillMap(map, [score('elimination method', 50)]);
    expect(map['elimination-method'].needsFundamentals).toBe(false);
    map = updateSkillMap(map, [score('elimination method', 49, 'w2')]);
    expect(map['elimination-method'].needsFundamentals).toBe(true);
  });

  it('caps history at 10 entries, dropping the oldest', () => {
    let map: SkillMap = {};
    for (let i = 1; i <= 12; i++) {
      map = updateSkillMap(map, [score('elimination method', 60, `w${i}`)]);
    }
    expect(map['elimination-method'].history).toHaveLength(10);
    expect(map['elimination-method'].history[0].worksheetId).toBe('w3');
    expect(map['elimination-method'].history[9].worksheetId).toBe('w12');
  });

  it('skips scores with an empty sub-skill', () => {
    const map = updateSkillMap({}, [score('', 90)]);
    expect(Object.keys(map)).toEqual([]);
  });

  it('handles multiple sub-skills scored in the same call', () => {
    const map = updateSkillMap({}, [score('elimination method', 90, 'w1'), score('word problems', 40, 'w1')]);
    expect(map['elimination-method'].history).toHaveLength(1);
    expect(map['word-problems'].history).toHaveLength(1);
  });
});
