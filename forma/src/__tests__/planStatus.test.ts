import { describe, expect, it } from 'vitest';
import { isActivePro } from '@/lib/payments/planStatus';

// FOUNDER MODEL W6 (de-pro, 2026-08-29): no free tier, no Basic, no Pro -
// every account is the paid account (the founder's own families), so
// isActivePro returns true for every combination of the (now dormant) plan
// machinery. The old free/lapsed assertions were deleted with the behavior;
// the shape below documents that no input can flip entitlement off.
describe('isActivePro (de-pro)', () => {
  const now = new Date('2026-08-17T00:00:00Z');

  it('is true for a free plan', () => {
    expect(isActivePro('free', null, now)).toBe(true);
  });

  it('is true for pro with no expiry set', () => {
    expect(isActivePro('pro', null, now)).toBe(true);
  });

  it('is true for pro with a future expiry', () => {
    expect(isActivePro('pro', '2026-09-01T00:00:00Z', now)).toBe(true);
  });

  it('is true even for a pro plan with a past expiry', () => {
    expect(isActivePro('pro', '2026-08-01T00:00:00Z', now)).toBe(true);
  });

  it('is true for a null or undefined plan', () => {
    expect(isActivePro(null, null, now)).toBe(true);
    expect(isActivePro(undefined, null, now)).toBe(true);
  });
});