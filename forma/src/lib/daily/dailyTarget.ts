// W8 Wave D (automatic daily quiz): picks WHAT the automatic daily quiz
// targets for a student. The daily quiz must be personalised to this
// student's exact weakness (the moat), never a generic set - so the target
// is decided in priority order:
//   1. RETURN TO FUNDAMENTALS - skill_map has a sub-skill flagged
//      needsFundamentals (most recent score below 50%): the AI identifies
//      the prerequisite and writes the whole set on that.
//   2. WEAKEST - the lowest-scoring, not-yet-mastered sub-skill in the map.
//   3. RECENT - no usable mastery data yet: fall back to the most recent
//      worksheet's topic so the very first auto-quiz still builds on
//      something the student has actually seen.
//   null when there is no history at all - nothing to personalise, and the
//   founder should generate the first one manually.
//
// Pure, no I/O - the caller feeds the skill_map plus the most-recent-
// worksheet rows (already fetched) and turns the result into a
// generateQuiz() targeting mode.
import { selectFundamentalsTarget } from '@/lib/mastery/selectFundamentalsTarget';
import type { SkillMap } from '@/lib/mastery/types';

export type DailyTargetKind = 'fundamentals' | 'weakest' | 'recent';

export interface DailyTarget {
  kind: DailyTargetKind;
  // Present for fundamentals/weakest - the exact canonical sub-skill name
  // (prompted as a subSkillDirective so mastery tracking stays canonical).
  subSkill?: string;
  topic: string;
  // Present for 'recent' (the worksheet's stored subject), folded into the
  // topic text since the profile's own subjects hint may differ.
  subject?: string;
}

export interface RecentWorksheetTopic {
  subject: string | null;
  topic: string | null;
}

export function selectDailyTarget(
  skillMap: SkillMap,
  recentWorksheets: RecentWorksheetTopic[]
): DailyTarget | null {
  // 1. Return to fundamentals wins outright (the most urgent signal).
  const fundamentals = selectFundamentalsTarget(skillMap);
  if (fundamentals) {
    return { kind: 'fundamentals', subSkill: fundamentals.subSkill, topic: fundamentals.topic };
  }

  // 2. Weakest non-mastered sub-skill: the lowest most-recent score, ties
  //    broken by most recent practice (the freshest struggle).
  let weakest: { subSkill: string; topic: string; score: number; at: string } | null = null;
  for (const entry of Object.values(skillMap)) {
    if (entry.mastered) continue;
    const latest = entry.history[entry.history.length - 1];
    if (!latest) continue;
    if (
      !weakest ||
      latest.score < weakest.score ||
      (latest.score === weakest.score && latest.at > weakest.at)
    ) {
      weakest = { subSkill: entry.subSkill, topic: latest.topic, score: latest.score, at: latest.at };
    }
  }
  if (weakest) {
    return { kind: 'weakest', subSkill: weakest.subSkill, topic: weakest.topic };
  }

  // 3. Newest worksheet seen (most recent first as supplied by the caller).
  for (const row of recentWorksheets) {
    if (row.topic) {
      return { kind: 'recent', topic: row.topic, subject: row.subject ?? undefined };
    }
  }

  return null;
}