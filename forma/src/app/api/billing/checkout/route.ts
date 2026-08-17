export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { initiateCheckout } from '@/lib/payments/flutterwave';
import { isSubscribableRole } from '@/lib/payments/plans';

// Phase 5 Step 26: starts a Flutterwave Standard checkout. The plan (and
// its price) is determined by the account's own role - Permissions
// Summary prices tutor and parent plans separately, there is no
// plan-picker UI.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { data: ownerRow } = await supabase.from('users').select('role, plan').eq('id', user.id).single();
  if (!ownerRow) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }
  if (ownerRow.plan === 'pro') {
    return NextResponse.json({ error: 'You are already on a paid plan.' }, { status: 400 });
  }
  if (!isSubscribableRole(ownerRow.role)) {
    return NextResponse.json({ error: 'Only tutor and parent accounts can subscribe.' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  try {
    const link = await initiateCheckout({
      userId: user.id,
      email: user.email,
      planKey: ownerRow.role,
      redirectUrl: `${appUrl}/api/payments/callback`,
    });
    return NextResponse.json({ link }, { status: 200 });
  } catch (error) {
    console.error('Failed to initiate Flutterwave checkout', error);
    return NextResponse.json({ error: 'Could not start checkout - please try again.' }, { status: 500 });
  }
}
