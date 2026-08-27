// Phase B Wave 1 (B5-B6): shared mastery-display logic consumed by BOTH the
// student mastery bars (B5) and the tutor class heat map (B6), so mastery
// levels are classified identically everywhere. Pure functions over
// student_profiles.skill_map - no I/O, no components, trivially testable.
//
// skill_map (types.ts) shape per entry:
//   { subSkill, history: [{score, worksheetId, topic, at}], mastered, masteredAt, needsFundamentals }
// Keys are slugified sub-skill names; entries carry the original display name
// in subSkill.

import type { SkillMap, SkillMapEntry } from './types';

export type MasteryLevel = 'mastered' | 'strong' | 'progressing' | 'weak';

export interface MasteryBar {
  key: string;
  subSkill: string;
  level: MasteryLevel;
  // Most recent score percentage (history[last].score), or null if no history.
  latestScore: number | null;
  attempts: number;
  topic: string | null;
}

// Higher mastery → better. Used to sort bars (mastered first, weak last) so
// the "needs work" sub-skills surface first in a tutor's view and the wins
// lead in a student's view.
const LEVEL_ORDER: Record<MasteryLevel, number> = {
  mastered: 0,
  strong: 1,
  progressing: 2,
  weak: 3,
};

function classify(entry: SkillMapEntry): MasteryLevel {
  if (entry.mastered) return 'mastered';
  // needsFundamentals is set when the most recent score dropped below the
  // fundamentals threshold - the clearest "this needs work" signal.
  if (entry.needsFundamentals) return 'weak';
  const latest = entry.history[entry.history.length - 1];
  if (latest && latest.score >= 85) return 'strong';
  return 'progressing';
}

export function toMasteryBars(skillMap: SkillMap | null | undefined): MasteryBar[] {
  if (!skillMap) return [];
  const bars: MasteryBar[] = Object.entries(skillMap).map(([key, entry]) => {
    const latest = entry.history[entry.history.length - 1];
    return {
      key,
      subSkill: entry.subSkill,
      level: classify(entry),
      latestScore: latest ? latest.score : null,
      attempts: entry.history.length,
      topic: latest ? latest.topic ?? null : null,
    };
  });
  bars.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return bars;
}

// Merges multiple students' skill maps into one set of bars, for the student
// portal case where one email matches more than one profile (multiple
// tutors). Sub-skill entries are aggregated by slug key - the highest
// mastery level and the union of history (by score) wins, so a student sees a
// single combined picture rather than per-tutor fragments.
export function toMasteryBarsAggregated(skillMaps: (SkillMap | null | undefined)[]): MasteryBar[] {
  const merged: Record<string, SkillMapEntry> = {};
  for (const map of skillMaps) {
    for (const [key, entry] of Object.entries(map ?? {})) {
      const existing = merged[key];
      if (!existing) {
        merged[key] = { ...entry };
        continue;
      }
      const bySet = (a: string, b: string) => Number(b) - Number(a);
      const combined = [...existing.history, ...entry.history].sort((a, b) => bySet(b.at, a.at));
      merged[key] = {
        subSkill: existing.subSkill || entry.subSkill,
        history: combined.slice(0, 10),
        mastered: existing.mastered || entry.mastered,
        masteredAt: existing.masteredAt ?? entry.masteredAt,
        needsFundamentals: existing.needsFundamentals || entry.needsFundamentals,
      };
    }
  }
  return toMasteryBars(merged);
}

export function masteryScore(bars: MasteryBar[]): number | null {
  if (bars.length === 0) return null;
  const scored = bars.filter((b) => b.latestScore != null);
  if (scored.length === 0) return null;
  const avg = scored.reduce((sum, b) => sum + (b.latestScore ?? 0), 0) / scored.length;
  return Math.round(avg);
}

// B6 (tutor class heat map): assemble a colour-coded grid from each
// student's skill_map. Pure, so the RSC stays thin and this is unit-testable
// without Supabase.
export interface HeatMapStudent {
  id: string;
  name: string;
  cols: Record<string, MasteryLevel | 'none'>;
  overall: number | null;
}

export interface HeatMap {
  // Sub-skill columns ordered most-commonly-practised first, so the grid's
  // most relevant columns lead rather than a random key order.
  columns: string[];
  students: HeatMapStudent[];
}

export function buildHeatMap(
  students: { id: string; name: string; skillMap: SkillMap | null }[]
): HeatMap {
  const columns = new Map<string, number>();
  const studentRows: HeatMapStudent[] = [];

  for (const student of students) {
    const bars = toMasteryBars(student.skillMap);
    const cols: HeatMapStudent['cols'] = {};
    for (const bar of bars) {
      cols[bar.key] = bar.level;
      columns.set(bar.key, (columns.get(bar.key) ?? 0) + 1);
    }
    studentRows.push({ id: student.id, name: student.name, cols, overall: masteryScore(bars) });
  }

  const orderedColumns = [...columns.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);

  return {
    columns: orderedColumns,
    students: studentRows.map((row) => ({
      id: row.id,
      name: row.name,
      cols: row.cols,
      overall: row.overall,
    })),
  };
}
