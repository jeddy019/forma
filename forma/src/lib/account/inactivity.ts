// Pure logic extracted out of the delete-inactive-accounts cron route so
// the actual inactivity decision is unit-testable in isolation from a real
// database - same "pure logic gets its own file and tests" discipline as
// isActivePro/nextDifficulty/isDueNow, and especially warranted here since
// this decision drives an irreversible deletion.

export function monthsAgoIso(months: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

// "Inactive" (Legal Requirements' 24-month policy, as defined by the
// user): no worksheet generated AND no login in the window, checked at
// the owner account level. hasRecentWorksheet is a batch/set-membership
// check the caller already has to do at the DB level (not something a
// pure function can meaningfully own); everything else is a pure
// comparison against cutoffIso.
export function isInactiveAccount(params: {
  hasRecentWorksheet: boolean;
  lastSignInAt: string | null | undefined;
  accountCreatedAt: string;
  cutoffIso: string;
}): boolean {
  if (params.hasRecentWorksheet) return false;
  const lastActivity = params.lastSignInAt ?? params.accountCreatedAt;
  return lastActivity < params.cutoffIso;
}
