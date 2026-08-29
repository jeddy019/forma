export const runtime = 'nodejs';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendRenewalReminderEmail } from '@/lib/email/send';
import { PLAN_PRICING, isSubscribableRole } from '@/lib/payments/plans';
import { resolveBranding } from '@/lib/branding';

// EMAIL 7: Renewal reminder - "3 days before expiry" (Email Templates).
// Runs daily (vercel.json) with a deliberately narrow window - only
// owners whose plan_expires_at falls in [now+3d, now+4d) get emailed on a
// given run, so each subscriber is naturally caught on exactly one daily
// run rather than every run between now and their expiry. No dedup beyond
// that window (same deliberate simplification as generate-scheduled's own
// documented "no already-notified suppression" gap) - a manually re-run
// cron on the same day could double-send, not solved here.
const REMINDER_WINDOW_START_DAYS = 3;
const REMINDER_WINDOW_END_DAYS = 4;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + REMINDER_WINDOW_START_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + REMINDER_WINDOW_END_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: owners, error } = await admin
    .from('users')
    .select('id, email, role, plan_expires_at, brand_name, brand_accent')
    .eq('plan', 'pro')
    .gte('plan_expires_at', windowStart)
    .lt('plan_expires_at', windowEnd);

  if (error) {
    console.error('Failed to query renewal-due owners', error);
    return NextResponse.json({ error: 'Failed to query owners' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const results = { processed: owners?.length ?? 0, sent: 0, skipped: 0 };

  for (const owner of owners ?? []) {
    if (!owner.email || !owner.plan_expires_at || !isSubscribableRole(owner.role)) {
      results.skipped++;
      continue;
    }
    const planName = owner.role === 'tutor' ? 'Tutor' : 'Parent';
    const sent = await sendRenewalReminderEmail(owner.email, {
      planName,
      amountFormatted: `$${PLAN_PRICING[owner.role].amount.toFixed(2)}`,
      expiryDateFormatted: new Date(owner.plan_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      billingUrl: `${appUrl}/dashboard/settings`,
      brandName: resolveBranding(owner).name,
    });
    if (sent) results.sent++;
  }

  return NextResponse.json(results, { status: 200 });
}
