import { PLAN_CURRENCY, PLAN_PRICING, type SubscribableRole } from './plans';
import { encodeTxRef } from './txRef';

// No Flutterwave SDK is listed in Tech Stack's install command - talks to
// the v3 REST API directly via fetch, same as every other external API in
// this project (Anthropic's SDK is the one exception, and that's a
// first-party client, not a payments SDK).
const FLW_BASE = 'https://api.flutterwave.com/v3';

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
}

interface FlutterwavePlan {
  id: number;
  name: string;
  status: string;
}

// Plans are looked up by name and created once, reused after - simpler
// than requiring the user to pre-create them by hand on the Flutterwave
// dashboard and wire plan IDs into .env.local, and there are only ever two
// (tutor, parent), so a list-then-create-if-missing call on first use has
// no real cost.
export async function getOrCreatePaymentPlanId(planKey: SubscribableRole): Promise<number> {
  const { name, amount } = PLAN_PRICING[planKey];

  const listRes = await fetch(`${FLW_BASE}/payment-plans`, { headers: authHeaders() });
  const listData = await listRes.json();
  const existing = ((listData.data ?? []) as FlutterwavePlan[]).find((p) => p.name === name && p.status === 'active');
  if (existing) return existing.id;

  const createRes = await fetch(`${FLW_BASE}/payment-plans`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ amount, name, interval: 'monthly', currency: PLAN_CURRENCY }),
  });
  const createData = await createRes.json();
  if (createData.status !== 'success' || !createData.data?.id) {
    throw new Error(`Failed to create Flutterwave payment plan: ${createData.message ?? 'unknown error'}`);
  }
  return createData.data.id as number;
}

export async function initiateCheckout(params: {
  userId: string;
  email: string;
  planKey: SubscribableRole;
  redirectUrl: string;
}): Promise<string> {
  const planId = await getOrCreatePaymentPlanId(params.planKey);
  const { amount, name } = PLAN_PRICING[params.planKey];
  const txRef = encodeTxRef(params.userId, params.planKey);

  const res = await fetch(`${FLW_BASE}/payments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      tx_ref: txRef,
      amount,
      currency: PLAN_CURRENCY,
      redirect_url: params.redirectUrl,
      payment_plan: planId,
      customer: { email: params.email },
      customizations: { title: name, description: `${name} subscription` },
    }),
  });
  const data = await res.json();
  if (data.status !== 'success' || !data.data?.link) {
    throw new Error(`Failed to initiate Flutterwave checkout: ${data.message ?? 'unknown error'}`);
  }
  return data.data.link as string;
}

export interface FlutterwaveVerifyResult {
  status: string; // 'success' (API call itself) - the transaction's own status is data.status
  data?: {
    id: number;
    tx_ref: string;
    status: string; // 'successful' | 'failed' | ...
    amount: number;
    currency: string;
    customer?: { email: string };
  };
}

// Never trust a client-redirect's own query params or a webhook payload's
// own "successful" claim as the final word - re-verify server-side against
// Flutterwave's own record before granting anything, same "never trust
// client-asserted state" discipline as /api/submit never trusting a
// client-supplied student_id.
export async function verifyTransaction(transactionId: string): Promise<FlutterwaveVerifyResult> {
  const res = await fetch(`${FLW_BASE}/transactions/${transactionId}/verify`, { headers: authHeaders() });
  return res.json();
}

export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const res = await fetch(`${FLW_BASE}/subscriptions/${subscriptionId}/cancel`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  const data = await res.json();
  return data.status === 'success';
}

// Used by the settings page's cancel action when no subscription id has
// been stored yet (e.g. it was created before this column existed, or the
// webhook/callback path that stores it hasn't been hit) - falls back to
// looking the customer up by email.
export async function findActiveSubscriptionId(email: string): Promise<string | null> {
  const res = await fetch(`${FLW_BASE}/subscriptions?email=${encodeURIComponent(email)}`, { headers: authHeaders() });
  const data = await res.json();
  const active = (data.data ?? []).find((s: { status?: string }) => s.status === 'active');
  return active ? String(active.id) : null;
}
