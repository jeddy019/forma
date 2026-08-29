import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isActivePro } from '@/lib/payments/planStatus';
import { PageHeader } from '@/lib/ui/PageHeader';
import { resolveBranding } from '@/lib/branding';
import SettingsPanel from './SettingsPanel';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at, brand_name, brand_accent').eq('id', user.id).single();

  const brand = resolveBranding(ownerRow);

  // Performance Rule 3: capped, not an unbounded list - billing history has
  // no pagination UI yet, 20 is generous for a $10-15/month product where
  // this grows one row a month at most.
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, currency, plan, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={Settings} title="Settings" subtitle="Brand, billing, and account." />
      <SettingsPanel
        role={ownerRow?.role ?? null}
        isPro={isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at)}
        planExpiresAt={ownerRow?.plan_expires_at ?? null}
        paymentNotice={payment === 'success' ? 'success' : payment === 'failed' ? 'failed' : null}
        invoices={invoices ?? []}
        brandName={brand.name}
        brandAccent={brand.accent}
      />
    </div>
  );
}
