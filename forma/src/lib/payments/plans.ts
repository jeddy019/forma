export type SubscribableRole = 'tutor' | 'parent';

// "TUTOR (pro, $15/month)" / "PARENT (pro, $10/month)" (Permissions
// Summary) - the plan and its price are determined by the account's role,
// there is no separate plan-choice UI. Flat USD for both, globally - "UK,
// US, and Canada" (Tech Stack's Payments line) has no per-region price
// table anywhere in CLAUDE.md, so this doesn't invent one; a follow-up
// could add regional pricing later.
export const PLAN_PRICING: Record<'tutor' | 'parent', { amount: number; name: string }> = {
  tutor: { amount: 15, name: 'Forma Tutor' },
  parent: { amount: 10, name: 'Forma Parent' },
};

export const PLAN_CURRENCY = 'USD';

export function isSubscribableRole(role: string | null | undefined): role is SubscribableRole {
  return role === 'tutor' || role === 'parent';
}
