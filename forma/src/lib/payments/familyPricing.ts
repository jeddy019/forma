// Founder model W4 (family plan): the inclusive family tiers decided with the
// user 2026-08-29 - one monthly price per family, priced by child count:
// £99 (1 child), £170 (2 children), £240 (3 children). Cap at 3: the offer
// defines no 4+ tier, so anything outside 1-3 returns null (no invented
// extrapolated price), and the schema/UI both refuse a 4th member. Parents
// keep paying the founder directly for now (W5 issues the branded invoice);
// this file only computes the number. Pure and unit-tested, same discipline
// as every other pricing/decision function in this codebase.

export const FAMILY_CURRENCY = 'GBP' as const;
export const FAMILY_MAX_CHILDREN = 3;

export const FAMILY_MONTHLY_PRICES: Record<number, number> = {
  1: 99,
  2: 170,
  3: 240,
};

export function familyMonthlyPrice(childCount: number): number | null {
  return childCount >= 1 && childCount <= FAMILY_MAX_CHILDREN ? FAMILY_MONTHLY_PRICES[childCount] : null;
}

export function familyMonthlyPriceLabel(childCount: number): string | null {
  const price = familyMonthlyPrice(childCount);
  return price === null ? null : `£${price} a month`;
}