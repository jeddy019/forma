export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyTransaction } from '@/lib/payments/flutterwave';
import { activateSubscriptionFromTransaction } from '@/lib/payments/activateSubscription';

// The browser's landing page after Flutterwave checkout (this is
// initiateCheckout's redirect_url). Not one of the two numbered Phase 5
// routes (Step 26's checkout, Step 27's webhook) - added alongside them
// because initiateCheckout requires a real redirect_url regardless (there
// has to be *something* for the browser to land on), and verifying the
// transaction synchronously here, not just trusting the query string
// Flutterwave appends, is standard Flutterwave integration practice and
// the only way to confirm a real payment end-to-end while the webhook's
// own URL is still a placeholder (per the user, until deployment).
// activateSubscriptionFromTransaction is shared with the webhook handler
// and idempotent by transaction id, so whichever path reaches a given
// transaction first is authoritative - the other becomes a no-op once the
// real webhook URL exists too.
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const status = request.nextUrl.searchParams.get('status');
  const transactionId = request.nextUrl.searchParams.get('transaction_id');

  if (status !== 'successful' || !transactionId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?payment=failed`);
  }

  try {
    const verified = await verifyTransaction(transactionId);
    if (verified?.data?.status !== 'successful') {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?payment=failed`);
    }

    const admin = createAdminClient();
    const result = await activateSubscriptionFromTransaction(admin, transactionId, verified.data.tx_ref);
    if (!result.activated && result.reason !== 'already processed') {
      console.error('Payment callback: activation failed', result.reason);
      return NextResponse.redirect(`${appUrl}/dashboard/settings?payment=failed`);
    }

    return NextResponse.redirect(`${appUrl}/dashboard/settings?payment=success`);
  } catch (error) {
    console.error('Payment callback verification failed', error);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?payment=failed`);
  }
}
