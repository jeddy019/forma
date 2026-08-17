import type { SubscribableRole } from './plans';

// tx_ref is how a completed transaction gets tied back to a user and a
// plan, both in the webhook and the redirect callback - Flutterwave hands
// it back verbatim in both paths. User IDs are UUIDs (which contain
// hyphens), so '_' is used as the separator, not '-', to keep splitting
// unambiguous. Pure encode/decode, no I/O - kept in its own file so it's
// unit-testable.
const PREFIX = 'forma';

export function encodeTxRef(userId: string, planKey: SubscribableRole): string {
  return `${PREFIX}_${userId}_${planKey}_${Date.now()}`;
}

export interface DecodedTxRef {
  userId: string;
  planKey: SubscribableRole;
}

export function decodeTxRef(txRef: string): DecodedTxRef | null {
  const parts = txRef.split('_');
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const [, userId, planKey] = parts;
  if (planKey !== 'tutor' && planKey !== 'parent') return null;
  return { userId, planKey };
}
