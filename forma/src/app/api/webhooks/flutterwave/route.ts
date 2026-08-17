export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTransaction } from '@/lib/payments/flutterwave';
import { activateSubscriptionFromTransaction } from '@/lib/payments/activateSubscription';

// Phase 5 Step 27. Flutterwave's webhook auth model is a plain shared
// secret compared verbatim (the "secret hash" set in the Flutterwave
// dashboard, echoed back in the verif-hash header on every call) - not an
// HMAC signature like Stripe's, so this is a direct string comparison, not
// a computed digest.
//
// NOTE: the webhook URL registered on the Flutterwave dashboard is a
// placeholder until this is actually deployed (per the user) - this route
// has not received a real webhook call yet. Its logic was verified this
// session via /api/payments/callback instead (the redirect path, which
// shares activateSubscriptionFromTransaction with this route and was
// exercised against a real completed test-mode transaction). Re-confirm
// this route specifically once the real URL is registered post-deployment.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('verif-hash');
  if (!signature || signature !== process.env.FLUTTERWAVE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { event?: string; data?: { id?: number; tx_ref?: string; status?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const eventType = body.event ?? 'unknown';
  const data = body.data ?? {};

  if (eventType === 'charge.completed' && data.status === 'successful' && data.id && data.tx_ref) {
    try {
      // Technical Challenge 8 / Security Rules 6: never act on the
      // payload's own "successful" claim alone - re-verify server-side
      // against Flutterwave's own record first.
      const verified = await verifyTransaction(String(data.id));
      if (verified?.data?.status === 'successful') {
        const admin = createAdminClient();
        await activateSubscriptionFromTransaction(admin, String(data.id), data.tx_ref);
      }
    } catch (error) {
      console.error('Failed to process Flutterwave webhook', error);
      // Still 200 below - Flutterwave retries on non-2xx, and a bug on our
      // side isn't more likely to succeed on a retry storm; log and move on.
    }
  } else {
    // "all event types" (Step 27) - logged rather than silently dropped,
    // even though only charge.completed has real handling today.
    console.log('Unhandled or non-actionable Flutterwave webhook event', eventType, data.status);
  }

  // Duplicates return 200 too (Technical Challenge 8) - handled inside
  // activateSubscriptionFromTransaction's own webhook_events check, not
  // re-implemented here.
  return NextResponse.json({ received: true }, { status: 200 });
}
