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

export function dayLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousDay(day: string): string {
  const d = new Date(day + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return dayLabel(d);
}

// Computes the current streak from a list of activity timestamps.
export function currentStreak(activityAt: (string | Date)[], now: Date): number {
  if (activityAt.length === 0) return 0;
  const activeDays = new Set<string>();
  for (const at of activityAt) {
    activeDays.add(dayLabel(new Date(at)));
  }

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
