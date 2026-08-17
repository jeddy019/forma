import { describe, expect, it } from 'vitest';
import { monthsAgoIso, isInactiveAccount } from '@/lib/account/inactivity';

describe('monthsAgoIso', () => {
  it('subtracts whole months from the given date', () => {
    const now = new Date('2026-08-17T00:00:00.000Z');
    expect(monthsAgoIso(24, now)).toBe('2024-08-17T00:00:00.000Z');
  });
});

describe('isInactiveAccount', () => {
  const cutoffIso = '2024-08-17T00:00:00.000Z';

  it('is active (not inactive) if a recent worksheet exists, regardless of login', () => {
    expect(
      isInactiveAccount({ hasRecentWorksheet: true, lastSignInAt: '2020-01-01T00:00:00.000Z', accountCreatedAt: '2019-01-01T00:00:00.000Z', cutoffIso })
    ).toBe(false);
  });

  it('is inactive when no recent worksheet and last sign-in is before the cutoff', () => {
    expect(
      isInactiveAccount({ hasRecentWorksheet: false, lastSignInAt: '2024-01-01T00:00:00.000Z', accountCreatedAt: '2019-01-01T00:00:00.000Z', cutoffIso })
    ).toBe(true);
  });

  it('is active when no recent worksheet but last sign-in is after the cutoff', () => {
    expect(
      isInactiveAccount({ hasRecentWorksheet: false, lastSignInAt: '2025-01-01T00:00:00.000Z', accountCreatedAt: '2019-01-01T00:00:00.000Z', cutoffIso })
    ).toBe(false);
  });

  it('falls back to accountCreatedAt when lastSignInAt is null (never signed in again after signup)', () => {
    expect(isInactiveAccount({ hasRecentWorksheet: false, lastSignInAt: null, accountCreatedAt: '2019-01-01T00:00:00.000Z', cutoffIso })).toBe(true);
    expect(isInactiveAccount({ hasRecentWorksheet: false, lastSignInAt: null, accountCreatedAt: '2025-01-01T00:00:00.000Z', cutoffIso })).toBe(false);
  });

  it('falls back to accountCreatedAt when lastSignInAt is undefined', () => {
    expect(isInactiveAccount({ hasRecentWorksheet: false, lastSignInAt: undefined, accountCreatedAt: '2019-01-01T00:00:00.000Z', cutoffIso })).toBe(true);
  });
});
