import { describe, expect, it } from 'vitest';
import { aiTutorAllowance, AI_TUTOR_BASIC_QUOTA } from '@/lib/payments/planStatus';

// FOUNDER MODEL W6 (de-pro): isActivePro returns true for every account, so
// aiTutorAllowance is Infinity for every combination of plan inputs, and the
// usage_log-limited AI tutor quota branch the allowance used to switch on
// never runs. The 'basic'/'free' branches in planStatus.ts are retained only
// as the documented shape of the future SaaS pricing (as are users.plan and
// its CHECK), which is why AI_TUTOR_BASIC_QUOTA and the basic-branch shape
// assertions below survive for when that price list is re-armed.
describe('aiTutorAllowance (B72 AI tutor chat entitlement, de-pro)', () => {
  const now = new Date('2026-08-28T00:00:00Z');

  it('is Infinity for every account', () => {
    expect(aiTutorAllowance('free', null, now)).toBe(Infinity);
    expect(aiTutorAllowance(null, null, now)).toBe(Infinity);
    expect(aiTutorAllowance(undefined, null, now)).toBe(Infinity);
    expect(aiTutorAllowance('pro', '2026-08-01T00:00:00Z', now)).toBe(Infinity);
    expect(aiTutorAllowance('pro', null, now)).toBe(Infinity);
    expect(aiTutorAllowance('pro', '2026-09-01T00:00:00Z', now)).toBe(Infinity);
  });

  it('keeps the documented Basic quota value for the dormant SaaS shape', () => {
    expect(AI_TUTOR_BASIC_QUOTA).toBe(5);
    expect(aiTutorAllowance('basic', '2026-09-01T00:00:00Z', now)).toBe(Infinity);
    expect(aiTutorAllowance('basic', '2026-08-01T00:00:00Z', now)).toBe(Infinity);
    expect(aiTutorAllowance('basic', null, now)).toBe(Infinity);
  });
});