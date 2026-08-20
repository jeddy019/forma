import type { SkillMap } from './types';

export interface FundamentalsTarget {
  subSkill: string;
  topic: string;
}

// Pure: Kumon Methodology's RETURN TO FUNDAMENTALS - scans a student's
// skill_map for any sub-skill flagged needsFundamentals (their most recent
// score on it was below 50%) and returns the one to route the next
// generation to. Ties (more than one sub-skill flagged at once) break on
// whichever was scored most recently - the most immediate struggle.
export function selectFundamentalsTarget(skillMap: SkillMap): FundamentalsTarget | null {
  let best: { subSkill: string; topic: string; at: string } | null = null;

  for (const entry of Object.values(skillMap)) {
    if (!entry.needsFundamentals) continue;
    const latest = entry.history[entry.history.length - 1];
    if (!latest) continue;
    if (!best || latest.at > best.at) {
      best = { subSkill: entry.subSkill, topic: latest.topic, at: latest.at };
    }
  }

  return best ? { subSkill: best.subSkill, topic: best.topic } : null;
}
