'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelSubscription, findActiveSubscriptionId } from '@/lib/payments/flutterwave';
import { deleteUserAccount } from '@/lib/account/deleteAccount';

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// Only downgrades locally once Flutterwave itself confirms the
// subscription is cancelled (or there was never one to cancel) - if the
// Flutterwave-side call fails, plan stays 'pro' and the user is told to
// retry or contact support, rather than losing access to something they
// may still be charged for next cycle.
export async function cancelSubscriptionAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { error: 'You must be signed in.' };
  }

  const { data: ownerRow } = await supabase
    .from('users')
    .select('plan, flutterwave_subscription_id')
    .eq('id', user.id)
    .single();
  if (!ownerRow || ownerRow.plan !== 'pro') {
    return { error: 'You are not on a paid plan.' };
  }

  const subscriptionId = ownerRow.flutterwave_subscription_id ?? (await findActiveSubscriptionId(user.email));

  if (subscriptionId) {
    const cancelled = await cancelSubscription(subscriptionId);
    if (!cancelled) {
      return { error: 'Could not cancel your subscription with Flutterwave - please try again or contact support.' };
    }
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ plan: 'free', plan_expires_at: null, flutterwave_subscription_id: null })
    .eq('id', user.id);
  if (updateError) {
    console.error('Failed to downgrade plan after cancellation', updateError);
    return { error: 'Subscription cancelled, but could not update your account - please contact support.' };
  }

  return { success: true };
}

// Legal Requirements: "Data deletion on request from settings page."
// Deletes in FK-dependency order (not every table cascades automatically -
// see the Database Schema section) rather than relying on cascade
// behaviour that isn't uniformly configured across every table.
export async function deleteAccountAction(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'You must be signed in.' };
  }

  const admin = createAdminClient();
  const result = await deleteUserAccount(admin, user.id);
  if (!result.success) {
    return { error: 'Could not delete your account - please try again or contact support.' };
  }

  return { success: true };
}
