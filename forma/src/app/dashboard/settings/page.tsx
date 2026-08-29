import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/lib/ui/PageHeader';
import { resolveBranding } from '@/lib/branding';
import SettingsPanel from './SettingsPanel';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase
    .from('users')
    .select('role, brand_name, brand_accent')
    .eq('id', user.id)
    .single();

  const brand = resolveBranding(ownerRow);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={Settings} title="Settings" subtitle="Brand and account." />
      <SettingsPanel role={ownerRow?.role ?? null} brandName={brand.name} brandAccent={brand.accent} />
    </div>
  );
}