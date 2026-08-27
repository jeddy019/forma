import { describe, expect, it } from 'vitest';
import { toMasteryBars, toMasteryBarsAggregated, buildHeatMap, masteryScore } from '@/lib/mastery/masteryView';
import type { SkillMap, SkillMapEntry } from '@/lib/mastery/types';

interface EntryFixture {
  key: string;
  entry: SkillMapEntry;
}

function entry(subSkill: string, scores: number[], topic: string, mastered = false): EntryFixture {
  const key = subSkill.replace(/\s+/g, '-').toLowerCase();
  const history = scores.map((score, i) => ({
    score,
    worksheetId: `w${i}`,
    topic,
    at: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }));
  const last = history[history.length - 1];
  return {
    key,
    entry: {
      subSkill,
      history,
      mastered,
      masteredAt: mastered ? last.at : null,
      needsFundamentals: last.score < 50,
    },
  };
}

function toMap(fixtures: EntryFixture[]): SkillMap {
  return Object.fromEntries(fixtures.map((f) => [f.key, f.entry]));
}

describe('masteryView.toMasteryBars', () => {
  it('classifies mastered vs weak vs progressing vs strong', () => {
    const map = toMap([
      entry('Elimination method', [90, 85], 'Equations', true), // mastered
      entry('Angles', [55, 60], 'Angles'), // progressing (latest 60, >=50, <85)
      entry('Linear equations', [30, 20], 'Equations'), // weak (needsFundamentals, latest < 50)
      entry('Ratio', [80, 88], 'Ratio'), // strong (latest >=85, not mastered)
    ]);
    const bars = toMasteryBars(map);
    const byKey = Object.fromEntries(bars.map((b) => [b.key, b.level]));
    expect(byKey['elimination-method']).toBe('mastered');
    expect(byKey['angles']).toBe('progressing');
    expect(byKey['linear-equations']).toBe('weak');
    expect(byKey['ratio']).toBe('strong');
  });

  it('sorts mastered first, weak last', () => {
    const map = toMap([
      entry('Angles', [55], 'Angles'),
      entry('Elimination method', [90, 85], 'Equations', true),
      entry('Linear equations', [20], 'Equations'),
    ]);
    const bars = toMasteryBars(map);
    expect(bars[0].key).toBe('elimination-method');
    expect(bars[bars.length - 1].key).toBe('linear-equations');
  });

  it('reports latestScore, attempts, topic from history', () => {
    const bars = toMasteryBars(toMap([entry('Ratio', [80, 88], 'Ratio')]));
    expect(bars[0].latestScore).toBe(88);
    expect(bars[0].attempts).toBe(2);
    expect(bars[0].topic).toBe('Ratio');
  });

  it('returns an empty array for an empty skill map', () => {
    expect(toMasteryBars({})).toEqual([]);
    expect(toMasteryBars(null)).toEqual([]);
  });
});

describe('masteryView.toMasteryBarsAggregated', () => {
  it('merges multiple students by slug key, keeping the best mastery state', () => {
    const a = toMap([entry('Elimination method', [90], 'Equations')]); // mastered=false
    const b = toMap([entry('Elimination method', [92, 90], 'Equations', true)]); // mastered=true
    const bars = toMasteryBarsAggregated([a, b]);
    expect(bars).toHaveLength(1);
    expect(bars[0].key).toBe('elimination-method');
    expect(bars[0].level).toBe('mastered');
    expect(bars[0].attempts).toBe(3);
  });

  it('keeps entries unique to one student', () => {
    const a = toMap([entry('Angles', [60], 'Angles')]);
    const b = toMap([entry('Ratio', [70], 'Ratio')]);
    const bars = toMasteryBarsAggregated([a, b]);
    expect(bars).toHaveLength(2);
  });

  it('ignores null/empty maps', () => {
    expect(toMasteryBarsAggregated([null, {}])).toEqual([]);
  });
});

describe('masteryView.masteryScore', () => {
  it('averages latest scores', () => {
    const bars = toMasteryBars(toMap([entry('A', [90], 'X'), entry('B', [50], 'Y')]));
    expect(masteryScore(bars)).toBe(70);
  });

  it('returns null with no scored sub-skills', () => {
    expect(masteryScore([])).toBeNull();
  });
});

describe('masteryView.buildHeatMap', () => {
  const students = [
    { id: 's1', name: 'Aisha', skillMap: toMap([entry('Elimination method', [90, 85], 'Equations', true), entry('Angles', [60], 'Angles')]) },
    { id: 's2', name: 'Naeto', skillMap: toMap([entry('Elimination method', [30, 20], 'Equations')]) },
    { id: 's3', name: 'Omar', skillMap: null },
  ];

  const heat = buildHeatMap(students);

  it('columns are the union of sub-skills, most-practised first', () => {
    // elimination-method appears for 2 students, angles for 1
    expect(heat.columns).toEqual(['elimination-method', 'angles']);
  });

  it('fills level per student, none where absent', () => {
    const byName = Object.fromEntries(heat.students.map((s) => [s.name, s]));
    expect(byName.Aisha.cols['elimination-method']).toBe('mastered');
    expect(byName.Aisha.cols['angles']).toBe('progressing');
    expect(byName.Naeto.cols['elimination-method']).toBe('weak');
    expect(byName.Omar.cols['elimination-method']).toBeUndefined();
  });

  it('computes per-student overall average', () => {
    const byName = Object.fromEntries(heat.students.map((s) => [s.name, s]));
    expect(byName.Aisha.overall).toBe(73); // (85 + 60) / 2
    expect(byName.Omar.overall).toBeNull();
  });

  it('returns empty columns when no student has any mastery data', () => {
    const empty = buildHeatMap([{ id: 's1', name: 'A', skillMap: {} }, { id: 's2', name: 'B', skillMap: null }]);
    expect(empty.columns).toEqual([]);
  });
});
