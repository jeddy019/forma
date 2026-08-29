import { describe, expect, it } from 'vitest';
import {
  familyMonthlyPrice,
  familyMonthlyPriceLabel,
  FAMILY_MAX_CHILDREN,
  FAMILY_MONTHLY_PRICES,
  FAMILY_CURRENCY,
} from '@/lib/payments/familyPricing';

describe('familyMonthlyPrice', () => {
  it('prices the three defined tiers exactly', () => {
    expect(familyMonthlyPrice(1)).toBe(99);
    expect(familyMonthlyPrice(2)).toBe(170);
    expect(familyMonthlyPrice(3)).toBe(240);
  });

  it('returns null outside the supported 1-3 range - no invented prices', () => {
    expect(familyMonthlyPrice(0)).toBeNull();
    expect(familyMonthlyPrice(4)).toBeNull();
    expect(familyMonthlyPrice(-1)).toBeNull();
  });
});

describe('familyMonthlyPriceLabel', () => {
  it('formats a GBP monthly label for a supported size', () => {
    expect(familyMonthlyPriceLabel(2)).toBe('£170 a month');
  });

  it('returns null for an unsupported size', () => {
    expect(familyMonthlyPriceLabel(4)).toBeNull();
  });
});

describe('family pricing constants', () => {
  it('keeps the cap and tiers consistent with the offer', () => {
    expect(FAMILY_MAX_CHILDREN).toBe(3);
    expect(FAMILY_MONTHLY_PRICES).toEqual({ 1: 99, 2: 170, 3: 240 });
    expect(FAMILY_CURRENCY).toBe('GBP');
  });
});