import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/supabase/ensureUserProfile';
import { DashboardSidebar } from './DashboardNav';
import { PageDoodles } from '@/lib/ui/PageDoodles';
import { resolveBranding } from '@/lib/branding';
import DashboardHomeLoading from './loading';

async function signOutAction() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// Browser-tab title carries the account's own brand name too (W1 identity
// layer) - the tab reads like the account owner's system, not the platform.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  const { data: brandRow } = await supabase.from('users').select('brand_name').eq('id', user.id).single();
  const brandName = resolveBranding(brandRow).name;
  return {
    title: `${brandName} - Practice built for your student`,
  };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated requests away from /dashboard,
  // so `user` should be set here. This first-visit-after-auth check creates
  // the users row if it doesn't exist yet - see ensureUserProfile.ts for why
  // that can't always happen at signup time.
  let role: string | null = null;
  let brandName = 'Forma';
  if (user) {
    role = await ensureUserProfile(supabase, user.id);
    // W1 identity layer: the sidebar wordmark carries the account's own
    // brand name (falls back to "Forma" when unset).
    const { data: brandRow } = await supabase.from('users').select('brand_name').eq('id', user.id).single();
    brandName = resolveBranding(brandRow).name;
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F7F4EF' }}>
      <DashboardSidebar role={role} userEmail={user?.email ?? null} brandName={brandName} signOutAction={signOutAction} />
      <main className="relative flex-1 min-w-0 px-6 md:px-10 py-8">
        <PageDoodles />
        <div className="relative max-w-4xl mx-auto animate-fade-up">
          {/* Stream the shell (header/nav above) immediately and let each page's
              data fetch resolve independently - linear-style: chrome paints
              first, content fills in instead of a blank screen for the whole
              serial Supabase chain. */}
          <Suspense fallback={<DashboardHomeLoading />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
