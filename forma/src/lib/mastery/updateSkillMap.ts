import { slugifySubSkill } from '../subSkill/slugifySubSkill';
import { HISTORY_CAP, MASTERY_CONSECUTIVE, MASTERY_THRESHOLD, FUNDAMENTALS_THRESHOLD, type SkillMap, type SkillMapEntry } from './types';

export interface SkillMapScoreInput {
  subSkill: string;
  topic: string;
  scorePercentage: number;
  worksheetId: string;
  at: string;
}

// Pure: takes the current skill_map plus one or more new scores (one
// submission can touch several sub-skills at once) and returns the updated
// map. Mastery is computed from the LAST TWO entries of that sub-skill's
// OWN history - this naturally satisfies "two consecutive worksheets on the
// SAME sub-skill" even when unrelated-subject or unrelated-sub-skill
// worksheets happen in between, since those never touch this key at all.
export function updateSkillMap(current: SkillMap, scores: SkillMapScoreInput[]): SkillMap {
  const next: SkillMap = { ...current };

  for (const score of scores) {
    const key = slugifySubSkill(score.subSkill);
    if (!key) continue; // defensive - an empty/whitespace-only subSkill has nothing to key on

    const existing = next[key];
    const history = [...(existing?.history ?? []), { score: score.scorePercentage, worksheetId: score.worksheetId, topic: score.topic, at: score.at }];
    if (history.length > HISTORY_CAP) {
      history.splice(0, history.length - HISTORY_CAP);
    }

    const lastTwo = history.slice(-MASTERY_CONSECUTIVE);
    const justMastered = lastTwo.length === MASTERY_CONSECUTIVE && lastTwo.every((entry) => entry.score >= MASTERY_THRESHOLD);
    const mastered = Boolean(existing?.mastered) || justMastered;

    const latest = history[history.length - 1];

    const entry: SkillMapEntry = {
      subSkill: score.subSkill,
      history,
      mastered,
      masteredAt: mastered ? (existing?.masteredAt ?? score.at) : null,
      needsFundamentals: latest.score < FUNDAMENTALS_THRESHOLD,
    };
    next[key] = entry;
  }

  return next;
}
