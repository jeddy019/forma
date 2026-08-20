import type { createAdminClient } from '@/lib/supabase/admin';
import { decodeTxRef } from './txRef';
import { PLAN_PRICING, isSubscribableRole, type SubscribableRole } from './plans';
import { sendPaymentConfirmedEmail, sendPaymentFailedEmail } from '@/lib/email/send';
import { findActiveSubscriptionId } from './flutterwave';
import { createInvoice } from '@/lib/invoices/createInvoice';

type AdminClient = ReturnType<typeof createAdminClient>;

const SUBSCRIPTION_PERIOD_DAYS = 30;

interface ChargeOwner {
  userId: string;
  planKey: SubscribableRole;
  email: string;
  isRenewal: boolean;
}

// Identifies which user a Flutterwave charge belongs to. The first charge
// on a subscription is initiated by this app via initiateCheckout, so its
// tx_ref is always this project's own forma_{userId}_{planKey}_{timestamp}
// format and decodeTxRef succeeds. A recurring charge Flutterwave itself
// initiates automatically on an existing payment-plan subscription (a
// renewal, or a failed renewal attempt) carries a Flutterwave-generated
// tx_ref instead, which decodeTxRef correctly rejects as malformed -
// customerEmail (from the same verifyTransaction response every caller
// already has, see FlutterwaveVerifyResult.data.customer.email) is the
// fallback identification path for that case. planKey comes from the
// stored role, not the tx_ref, when falling back - role is what actually
// determines pricing (see plans.ts's PLAN_PRICING), so nothing about
// which plan was purchased needs to be re-decoded here, only who to
// credit or notify.
async function identifyChargeOwner(
  admin: AdminClient,
  txRef: string,
  customerEmail?: string | null
): Promise<ChargeOwner | null> {
  const decoded = decodeTxRef(txRef);
  if (decoded) {
    const { data: userRow } = await admin.from('users').select('email').eq('id', decoded.userId).maybeSingle();
    if (!userRow?.email) return null;
    return { userId: decoded.userId, planKey: decoded.planKey, email: userRow.email, isRenewal: false };
  }
  if (customerEmail) {
    const { data: userRow } = await admin.from('users').select('id, role').eq('email', customerEmail).maybeSingle();
    if (!userRow || !isSubscribableRole(userRow.role)) return null;
    return { userId: userRow.id, planKey: userRow.role, email: customerEmail, isRenewal: true };
  }
  return null;
}

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
  txRef: string,
  customerEmail?: string | null,
  // Optional so both existing call sites keep compiling if either omits
  // them, but both actually pass verifyTransaction's own data.amount/
  // data.currency (the real charged amount, not PLAN_PRICING's static
  // list) - used for the invoice only; the confirmation email's own
  // amountFormatted line below is unchanged and still reads from
  // PLAN_PRICING, matching its pre-existing behaviour.
  chargedAmount?: number,
  chargedCurrency?: string
): Promise<{ activated: boolean; reason?: string }> {
  const eventId = `flw-tx-${transactionId}`;

  const { data: existing } = await admin.from('webhook_events').select('id').eq('event_id', eventId).maybeSingle();
  if (existing) {
    return { activated: false, reason: 'already processed' };
  }

  const owner = await identifyChargeOwner(admin, txRef, customerEmail);
  if (!owner) {
    return { activated: false, reason: `could not identify charge owner for tx_ref: ${txRef}` };
  }

  // Best-effort - a lookup failure here must not block activation itself;
  // cancelSubscriptionAction already falls back to the same by-email
  // lookup if the column is still empty.
  let subscriptionId: string | null = null;
  try {
    subscriptionId = await findActiveSubscriptionId(owner.email);
  } catch (error) {
    console.error('Failed to look up Flutterwave subscription id', error);
  }

  const expiresAt = new Date(Date.now() + SUBSCRIPTION_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await admin
    .from('users')
    .update({
      plan: 'pro',
      plan_expires_at: expiresAt,
      ...(subscriptionId ? { flutterwave_subscription_id: subscriptionId } : {}),
    })
    .eq('id', owner.userId);
  if (updateError) {
    return { activated: false, reason: `failed to update user plan: ${updateError.message}` };
  }

  // Recorded even if nothing else "uses" it - this row's existence IS the
  // idempotency guard for next time (including the next renewal charge,
  // which gets its own distinct transactionId and therefore its own
  // eventId here - idempotency is naturally per-charge, not per-user).
  await admin.from('webhook_events').insert({
    provider: 'flutterwave',
    event_id: eventId,
    event_type: owner.isRenewal ? 'charge.completed.renewal' : 'charge.completed',
    processed_at: new Date().toISOString(),
  });

  const planName = owner.planKey === 'tutor' ? 'Tutor' : 'Parent';

  // Best-effort, same as the subscription-id lookup above - a PDF/DB
  // failure here must not undo the plan activation that already happened,
  // it just means the confirmation email goes out without an attachment
  // (PaymentConfirmedEmail's invoiceAttached prop covers that case).
  let invoicePdf: { filename: string; content: Buffer } | undefined;
  try {
    const invoice = await createInvoice(admin, {
      userId: owner.userId,
      customerEmail: owner.email,
      paymentReference: transactionId,
      amount: chargedAmount ?? PLAN_PRICING[owner.planKey].amount,
      currency: chargedCurrency ?? 'USD',
      planKey: owner.planKey,
    });
    if (invoice) {
      invoicePdf = { filename: `${invoice.invoiceNumber}.pdf`, content: invoice.pdfBuffer };
    }
  } catch (error) {
    console.error('Failed to create invoice', error);
  }

  await sendPaymentConfirmedEmail(
    owner.email,
    {
      planName,
      amountFormatted: `$${PLAN_PRICING[owner.planKey].amount.toFixed(2)}`,
      renewalDateFormatted: new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      invoiceAttached: Boolean(invoicePdf),
    },
    invoicePdf
  );

  return { activated: true };
}

// EMAIL 8 (Email Templates): "Payment failed with retry link." Mirrors
// activateSubscriptionFromTransaction's own idempotency/identification
// shape exactly, but for a charge that did NOT succeed - called from the
// webhook when Flutterwave reports a failed charge.completed (covers both
// a failed first payment and a failed renewal attempt, via the same
// identifyChargeOwner fallback). No local plan state changes here - a
// failed charge doesn't downgrade anything by itself, it just tells the
// owner their card needs attention before plan_expires_at actually lapses.
export async function notifyPaymentFailedFromTransaction(
  admin: AdminClient,
  transactionId: string,
  txRef: string,
  customerEmail: string | null | undefined,
  retryUrl: string
): Promise<{ notified: boolean; reason?: string }> {
  const eventId = `flw-tx-failed-${transactionId}`;

  const { data: existing } = await admin.from('webhook_events').select('id').eq('event_id', eventId).maybeSingle();
  if (existing) {
    return { notified: false, reason: 'already processed' };
  }

  const owner = await identifyChargeOwner(admin, txRef, customerEmail);
  if (!owner) {
    return { notified: false, reason: `could not identify charge owner for tx_ref: ${txRef}` };
  }

  await admin.from('webhook_events').insert({
    provider: 'flutterwave',
    event_id: eventId,
    event_type: 'charge.failed',
    processed_at: new Date().toISOString(),
  });

  const planName = owner.planKey === 'tutor' ? 'Tutor' : 'Parent';
  await sendPaymentFailedEmail(owner.email, { planName, retryUrl });

  return { notified: true };
}
