// Pure logic extracted out of /api/generate's route handler so it's
// unit-testable, same "pure logic gets its own file and tests" discipline
// as nextDifficulty.ts and isDueNow.ts.
//
// FOUNDER MODEL W6 (de-pro, decided with the user 2026-08-29): there is no
// free tier, no Basic, and no Pro any more - every account IS the paid
// account, because the only accounts that exist are the founder's own
// families and students, sold one inclusive monthly price via
// /dashboard/families. The plan columns and their gates are NOT removed -
// the users.plan CHECK, check_and_log_generation, aiTutorAllowance's
// basic/free branches and the Flutterwave checkout all stay dormant for the
// day the software is sold to other tutors (roadmap note: white-label SaaS)
// - they are just no longer the thing that decides anything. This function
// is the single choke point every entitlement reads through (~25 call
// sites: marking, mastery, templates, group mode, schedule, session notes,
// /api/pdf, AI tutor quota, session brief), so flipping it here flips all
// of them without an edit each, and the free-tier generation cap branches
// in /api/generate and generateQuiz go dead with it.
// 'plan', 'planExpiresAt', and '_now' are retained for signature stability
// across the ~25 was-choke-point call sites and the dormant plan machinery's
// documented shape; de-pro ignores all three.
export function isActivePro(plan: string | null | undefined, planExpiresAt: string | null | undefined, _now: Date = new Date()): boolean {
  void _now;
  return true;
}

// Phase B Wave 4 (B72): cost of AI tutor chat entitlements, returned as the
// maximum number of tutor messages a student may send per quiz. Pricing
// revision (CLAUDE.md, 2026-08-27): Free has no AI tutor, Basic gets 5 per
// quiz, Pro unlimited. Returns Infinity for unlimited rather than a huge
// sentinel so callers can branch on Number.isFinite(allowance).
//
// De-pro (W6): isActivePro above returns true for every account, so the
// allowance is Infinity for everyone - the 'basic'/'free' branches below are
// retained purely as the documented shape of the future SaaS pricing, same
// rationale as the dormant plan columns in isActivePro's comment. The
// users.plan CHECK constraint in the current schema only admits 'free' and
// 'pro', so the Basic branch is dead even in that future until the billing
// workstream adds the 'basic' value (the CHECK lives in the schema SQL, not
// code).
export const AI_TUTOR_BASIC_QUOTA = 5;

export function aiTutorAllowance(plan: string | null | undefined, planExpiresAt: string | null | undefined, now: Date = new Date()): number {
  if (isActivePro(plan, planExpiresAt, now)) return Infinity;
  if (plan === 'basic' && planExpiresAt && new Date(planExpiresAt) > now) return AI_TUTOR_BASIC_QUOTA;
  return 0;
}