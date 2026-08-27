// Phase B Wave 1 (B7): spaced repetition engine (pure, no I/O - trivially
// testable). CLAUDE.md B7: "SRS schedules reviews at increasing intervals
// (1d, 3d, 7d, 14d, 30d). Uses SuperMemo SM-2 algorithm or open-source
// ts-fsrs." We use a lightweight interval-ladder scheduler rather than
// pulling in a dependency (ts-fsrs) - it expresses the exact documented
// ladder (1/3/7/14/30) directly, keeps the dependency tree minimal per
// Performance Rule 8, and is simpler to reason about for the mastery model.
//
// Semantics: each student opts in to spaced review for a sub-skill. A review
// is a pass/fail. PASS advances up the ladder (1→3→7→14→30, capped);
// FAIL resets to day 1. The next review is scheduled that many days ahead.

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const;

export interface ReviewEntry {
  studentId: string;
  // Slug key - intentionally matches the skill_map keys in mastery/types.ts
  // (slugifySubSkill output), so SRS rows and mastery bars share one
  // sub-skill identity across features.
  subSkill: string;
  // Display name for direct rendering without a join back to skill_map.
  subSkillLabel: string;
  topic: string | null;
  nextReviewAt: string; // ISO timestamp
  intervalDays: number;
  ladderStep: number;
  lastReviewedAt: string | null;
}

export interface ReviewSeed {
  studentId: string;
  subSkill: string;
  subSkillLabel: string;
  topic: string | null;
}

// A fresh opt-in starts at the first rung: due one day from now.
export function initialReview(seed: ReviewSeed, now: Date): ReviewEntry {
  const next = addDays(now, REVIEW_INTERVALS[0]);
  return {
    studentId: seed.studentId,
    subSkill: seed.subSkill,
    subSkillLabel: seed.subSkillLabel,
    topic: seed.topic,
    nextReviewAt: next.toISOString(),
    intervalDays: REVIEW_INTERVALS[0],
    ladderStep: 0,
    lastReviewedAt: null,
  };
}

// Produces the next state after a review. `passed` is the pass/fail grade.
export function scheduleNextReview(entry: ReviewEntry, passed: boolean, now: Date): ReviewEntry {
  if (passed) {
    const nextStep = Math.min(entry.ladderStep + 1, REVIEW_INTERVALS.length - 1);
    const intervalDays = REVIEW_INTERVALS[nextStep];
    return {
      ...entry,
      ladderStep: nextStep,
      intervalDays,
      nextReviewAt: addDays(now, intervalDays).toISOString(),
      lastReviewedAt: now.toISOString(),
    };
  }
  // Fail: return to day 1 (RETURN TO FUNDAMENTALS spirit - re-secure the
  // basics before spacing back out).
  return {
    ...entry,
    ladderStep: 0,
    intervalDays: REVIEW_INTERVALS[0],
    nextReviewAt: addDays(now, REVIEW_INTERVALS[0]).toISOString(),
    lastReviewedAt: now.toISOString(),
  };
}

// A review is due once the current time is at/after its scheduled time.
export function isDue(entry: Pick<ReviewEntry, 'nextReviewAt'>, now: Date): boolean {
  return new Date(entry.nextReviewAt).getTime() <= now.getTime();
}

// Filters to the entries currently due (the "review today" list driver).
export function dueReviews(entries: ReviewEntry[], now: Date): ReviewEntry[] {
  return entries.filter((e) => isDue(e, now));
}

// Human-friendly next-due label for the portal, e.g. "tomorrow", "in 3 days".
export function nextDueLabel(entry: Pick<ReviewEntry, 'nextReviewAt'>, now: Date): string {
  if (isDue(entry, now)) return 'due now';
  const diffDays = Math.ceil((new Date(entry.nextReviewAt).getTime() - now.getTime()) / 86400000);
  if (diffDays <= 1) return 'tomorrow';
  return `in ${diffDays} days`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
