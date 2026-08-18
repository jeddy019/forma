import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { isActivePro } from '@/lib/payments/planStatus';
import { PageHeader } from '@/lib/ui/PageHeader';
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

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={Settings} title="Settings" subtitle="Billing, plan, and account." />
      <SettingsPanel
        role={ownerRow?.role ?? null}
        isPro={isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at)}
        planExpiresAt={ownerRow?.plan_expires_at ?? null}
        paymentNotice={payment === 'success' ? 'success' : payment === 'failed' ? 'failed' : null}
      />
    </div>
  );
}
