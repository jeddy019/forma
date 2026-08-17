import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Settings</h1>
        <p className="text-sm text-[#5C5849]">Billing, plan, and account.</p>
      </div>
      <SettingsPanel
        role={ownerRow?.role ?? null}
        plan={ownerRow?.plan ?? 'free'}
        planExpiresAt={ownerRow?.plan_expires_at ?? null}
        paymentNotice={payment === 'success' ? 'success' : payment === 'failed' ? 'failed' : null}
      />
    </div>
  );
}
