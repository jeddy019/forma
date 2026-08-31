// Phase B Wave 1 (B8-B9): daily streak counter. CLAUDE.md gamification policy
// keeps this deliberately minimal - "a simple number, no complexity" - no
// freezes, no XP, no badges. Pure, no I/O, trivially testable.
//
// Semantics: a day "counts" if there was any activity (a quiz/worksheet
// submission, per its submitted_at) on that calendar day. The current streak
// counts consecutive active days running back from today. If there is no
// activity TODAY yet but there was yesterday, the streak is not considered
// broken (the student just hasn't done today's yet) - so the count starts
// from yesterday. Only once no activity happened yesterday either does the
// streak reset to 0.
//
// Timezone: day boundaries are computed in UTC (date.toISOString().slice(0,10)).
// The student's own timezone isn't stored, so deriving a per-day label in UTC
// is a documented, reproducible default.
//
// W5 B78 (streak freeze): one free pass per calendar month. When the streak
// would otherwise reset from a SINGLE missed day (no activity today or
// yesterday, but activity on the day before that), an unconsumed monthly
// freeze bridges that one day and the streak survives. Frozen days are stored
// per student (student_profiles.streak_freeze_days, comma-separated UTC day
// labels) and treated as active days forever after - so a bridged day never
// needs re-bridging, and at most one freeze can be spent per calendar month
// (the check is against the MISSED day's month, which is conservative across
// a month boundary: a break on 1 Sep whose missed day is 31 Aug still counts
// against August).
//
// Pro-only by pricing spec; in the founder model every student is effectively
// pro (isActivePro always true), so no gate is applied here or in the portal.

export function dayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const d = new Date(day + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return dayLabel(d);
}

// 'YYYY-MM' month of a 'YYYY-MM-DD' day label - UTC by construction, since
// the label itself is already UTC.
export function freezeMonth(day: string): string {
  return day.slice(0, 7);
}

// Parses the stored comma-separated frozen-day list ('' or null-safe).
export function splitFrozenDays(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').filter((d) => d.trim().length > 0);
}

// Re-serialises frozen days for storage, deduplicated and sorted.
export function joinFrozenDays(days: string[]): string {
  return [...new Set(days)].sort().join(',');
}

// Adds one frozen day unless already present.
export function appendFrozenDay(days: string[], day: string): string[] {
  if (days.includes(day)) return days;
  return [...days, day].sort();
}

function streakFromSet(activeDays: Set<string>, now: Date): number {
  const today = dayLabel(now);
  // Start from today if it has activity; otherwise from yesterday (grace for
  // not-yet-active today).
  let cursor = activeDays.has(today) ? today : previousDay(today);
  if (!activeDays.has(cursor)) return 0;

  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

// Computes the current streak from a list of activity timestamps.
export function currentStreak(activityAt: (string | Date)[], now: Date): number {
  const activeDays = new Set<string>();
  for (const at of activityAt) {
    activeDays.add(dayLabel(new Date(at)));
  }
  return streakFromSet(activeDays, now);
}

export interface StreakFreezeOutcome {
  streak: number;
  // The single day to persist as frozen (a 'YYYY-MM-DD' label), or null when
  // nothing was bridged - either the streak was already alive, the break was
  // more than one day, or this month's freeze was already spent.
  dayToFreeze: string | null;
}

// Streak with the B78 freeze applied. frozenDays are previously-bridged days
// (already consumed freezes); they join the activity set as active days.
export function currentStreakWithFreeze(
  activityAt: (string | Date)[],
  frozenDays: string[],
  now: Date
): StreakFreezeOutcome {
  const activeDays = new Set<string>();
  for (const at of activityAt) {
    activeDays.add(dayLabel(new Date(at)));
  }
  for (const day of frozenDays) {
    activeDays.add(day);
  }

  const plain = streakFromSet(activeDays, now);
  if (plain > 0) return { streak: plain, dayToFreeze: null };

  const today = dayLabel(now);
  const yesterday = previousDay(today);
  const dayBeforeYesterday = previousDay(yesterday);

  // A freeze only rescues a single missed day: yesterday missing but the day
  // before yesterday active. A longer break is a real reset.
  if (!activeDays.has(dayBeforeYesterday)) return { streak: 0, dayToFreeze: null };
  // One freeze per calendar month, keyed on the missed day's month.
  if (frozenDays.some((d) => freezeMonth(d) === freezeMonth(yesterday))) {
    return { streak: 0, dayToFreeze: null };
  }

  // Bridge yesterday and recount.
  activeDays.add(yesterday);
  return { streak: streakFromSet(activeDays, now), dayToFreeze: yesterday };
}