import type { createAdminClient } from '@/lib/supabase/admin';
import { decodeTxRef } from './txRef';
import { PLAN_PRICING } from './plans';
import { sendPaymentConfirmedEmail } from '@/lib/email/send';
import { findActiveSubscriptionId } from './flutterwave';

type AdminClient = ReturnType<typeof createAdminClient>;

const SUBSCRIPTION_PERIOD_DAYS = 30;

// Shared by both /api/webhooks/flutterwave (async, server-to-server) and
// /api/payments/callback (synchronous, on the browser's return from
// checkout) - the webhook's own public URL is only a placeholder until
// deployment (per the user), so the callback path is how this gets
// exercised for real right now. Both call this with a real, already
// server-side-verified transaction (see verifyTransaction in
// flutterwave.ts) - this function itself does not call Flutterwave again,
// it only writes the result.
//
// Idempotent via webhook_events, keyed by transaction id - whichever path
// (webhook or callback) reaches a given transaction first "wins"; the
// other becomes a no-op. This is also how the same transaction being
// confirmed by both paths (once the real webhook URL exists after
// deployment) stays safe - not just a same-path duplicate-delivery case.
export async function activateSubscriptionFromTransaction(
  admin: AdminClient,
  transactionId: string,
  txRef: string
): Promise<{ activated: boolean; reason?: string }> {
  const eventId = `flw-tx-${transactionId}`;

  const { data: existing } = await admin.from('webhook_events').select('id').eq('event_id', eventId).maybeSingle();
  if (existing) {
    return { activated: false, reason: 'already processed' };
  }

  const decoded = decodeTxRef(txRef);
  if (!decoded) {
    return { activated: false, reason: `malformed tx_ref: ${txRef}` };
  }

  const expiresAt = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: userRow } = await admin.from('users').select('email').eq('id', decoded.userId).single();

  // Best-effort - Flutterwave's charge.completed payload has no
  // subscription id of its own, so this is the only way to capture it at
  // activation time. A lookup failure here must not block activation
  // itself; cancelSubscriptionAction already falls back to the same
  // by-email lookup if the column is still empty.
  let subscriptionId: string | null = null;
  if (userRow?.email) {
    try {
      subscriptionId = await findActiveSubscriptionId(userRow.email);
    } catch (error) {
      console.error('Failed to look up Flutterwave subscription id', error);
    }
  }

  const { error: updateError } = await admin
    .from('users')
    .update({
      plan: 'pro',
      plan_expires_at: expiresAt,
      ...(subscriptionId ? { flutterwave_subscription_id: subscriptionId } : {}),
    })
    .eq('id', decoded.userId);
  if (updateError) {
    return { activated: false, reason: `failed to update user plan: ${updateError.message}` };
  }

  // Recorded even if the insert below is the only thing that "uses" it -
  // this row's existence IS the idempotency guard for next time.
  await admin.from('webhook_events').insert({
    provider: 'flutterwave',
    event_id: eventId,
    event_type: 'charge.completed',
    processed_at: new Date().toISOString(),
  });

  if (userRow?.email) {
    const planName = decoded.planKey === 'tutor' ? 'Tutor' : 'Parent';
    await sendPaymentConfirmedEmail(userRow.email, {
      planName,
      amountFormatted: `$${PLAN_PRICING[decoded.planKey].amount.toFixed(2)}`,
      renewalDateFormatted: new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
  }

  return { activated: true };
}
