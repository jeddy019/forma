// Pure logic extracted out of /api/generate's route handler so it's
// unit-testable, same "pure logic gets its own file and tests" discipline
// as nextDifficulty.ts and isDueNow.ts. "Active" checks plan_expires_at,
// not just plan === 'pro': a lapsed subscription whose downgrade
// cron/webhook hasn't run yet must not get an unlimited free ride.
export function isActivePro(plan: string | null | undefined, planExpiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (plan !== 'pro') return false;
  if (!planExpiresAt) return true;
  return new Date(planExpiresAt) > now;
}
