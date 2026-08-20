import { slugifySubSkill } from '../subSkill/slugifySubSkill';

export interface SubSkillPartEntry {
  subSkill: string | null | undefined;
  marksAwarded: number;
  marksAvailable: number;
}

export interface SubSkillTotals {
  label: string;
  awarded: number;
  available: number;
}

// Pure: groups per-part marks by sub-skill within ONE submission. Entries
// with an empty/missing subSkill are skipped, never thrown on - this is the
// defensive path for pre-Step-37 worksheets/submissions that predate the
// sub_skill field existing at all; current_difficulty still updates from
// the whole-submission score regardless (see recordScore.ts), only the
// per-sub-skill breakdown is unavailable for those.
export function accumulateBySubSkill(entries: SubSkillPartEntry[]): Record<string, SubSkillTotals> {
  const totals: Record<string, SubSkillTotals> = {};

  for (const entry of entries) {
    const raw = entry.subSkill;
    if (!raw || raw.trim().length === 0) continue;
    const key = slugifySubSkill(raw);
    if (!key) continue;

    const existing = totals[key];
    if (existing) {
      existing.awarded += entry.marksAwarded;
      existing.available += entry.marksAvailable;
    } else {
      // First sighting of this slug wins the display label - later entries
      // with different casing/whitespace still merge into the same key.
      totals[key] = { label: raw, awarded: entry.marksAwarded, available: entry.marksAvailable };
    }
  }

  return totals;
}
