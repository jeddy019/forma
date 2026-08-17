import { describe, expect, it } from 'vitest';
import { isActivePro } from '@/lib/payments/planStatus';

describe('isActivePro', () => {
  const now = new Date('2026-08-17T00:00:00Z');

  it('is false for a free plan', () => {
    expect(isActivePro('free', null, now)).toBe(false);
  });

  it('is true for pro with no expiry set', () => {
    expect(isActivePro('pro', null, now)).toBe(true);
  });

  it('is true for pro with a future expiry', () => {
    expect(isActivePro('pro', '2026-09-01T00:00:00Z', now)).toBe(true);
  });

  it('is false for pro with a past expiry', () => {
    expect(isActivePro('pro', '2026-08-01T00:00:00Z', now)).toBe(false);
  });

  it('is false for a null or undefined plan', () => {
    expect(isActivePro(null, null, now)).toBe(false);
    expect(isActivePro(undefined, null, now)).toBe(false);
  });
});
