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

// Phase B Wave 4 (B72): cost of AI tutor chat entitlements, returned as the
// maximum number of tutor messages a student may send per quiz. Pricing
// revision (CLAUDE.md, 2026-08-27): Free has no AI tutor, Basic gets 5 per
// quiz, Pro unlimited. Returns Infinity for unlimited rather than a huge
// sentinel so callers can branch on Number.isFinite(allowance).
//
// Note: the users.plan CHECK constraint in the current schema only admits
// 'free' and 'pro', so the Basic branch below is dead until the billing
// workstream adds the 'basic' value (the CHECK lives in the schema SQL, not
// code) - it's written now so the cap is already correct when that happens,
// the same way pricing is documented ahead of its billing implementation.
export const AI_TUTOR_BASIC_QUOTA = 5;

export function aiTutorAllowance(plan: string | null | undefined, planExpiresAt: string | null | undefined, now: Date = new Date()): number {
  if (isActivePro(plan, planExpiresAt, now)) return Infinity;
  if (plan === 'basic' && planExpiresAt && new Date(planExpiresAt) > now) return AI_TUTOR_BASIC_QUOTA;
  return 0;
}
