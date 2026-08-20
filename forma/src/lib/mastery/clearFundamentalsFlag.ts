import { slugifySubSkill } from '../subSkill/slugifySubSkill';
import type { SkillMap } from './types';

// Pure: clears needsFundamentals on exactly one sub-skill, leaving
// everything else (history, mastered, masteredAt, other sub-skills)
// untouched. Called after a fundamentals-routed worksheet is successfully
// generated - see the generation routes for why this must happen
// immediately, not on a later score: without it, every later unrelated
// generation would keep redirecting to the same prerequisite forever,
// since scoring the PREREQUISITE worksheet updates a DIFFERENT sub-skill
// key and never touches the originally-flagged one.
export function clearFundamentalsFlag(skillMap: SkillMap, subSkill: string): SkillMap {
  const key = slugifySubSkill(subSkill);
  const existing = skillMap[key];
  if (!existing) return skillMap;

  return { ...skillMap, [key]: { ...existing, needsFundamentals: false } };
}
