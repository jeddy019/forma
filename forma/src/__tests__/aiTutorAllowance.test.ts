import { describe, expect, it } from 'vitest';
import { aiTutorAllowance, AI_TUTOR_BASIC_QUOTA } from '@/lib/payments/planStatus';

describe('aiTutorAllowance (B72 AI tutor chat entitlement)', () => {
  const now = new Date('2026-08-28T00:00:00Z');

  it('returns 0 for a free plan', () => {
    expect(aiTutorAllowance('free', null, now)).toBe(0);
  });

  it('returns 0 for a null or undefined plan', () => {
    expect(aiTutorAllowance(null, null, now)).toBe(0);
    expect(aiTutorAllowance(undefined, null, now)).toBe(0);
  });

  it('returns 0 for a lapsed pro plan (expiry in the past)', () => {
    expect(aiTutorAllowance('pro', '2026-08-01T00:00:00Z', now)).toBe(0);
  });

  it('returns Infinity for active pro (unlimited)', () => {
    expect(aiTutorAllowance('pro', null, now)).toBe(Infinity);
    expect(aiTutorAllowance('pro', '2026-09-01T00:00:00Z', now)).toBe(Infinity);
  });

  it('returns the Basic quota for an active basic plan', () => {
    expect(aiTutorAllowance('basic', '2026-09-01T00:00:00Z', now)).toBe(AI_TUTOR_BASIC_QUOTA);
    expect(AI_TUTOR_BASIC_QUOTA).toBe(5);
  });

  it('returns 0 for a lapsed basic plan', () => {
    expect(aiTutorAllowance('basic', '2026-08-01T00:00:00Z', now)).toBe(0);
    expect(aiTutorAllowance('basic', null, now)).toBe(0);
  });
});