import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/supabase/ensureUserProfile';
import { DashboardSidebar } from './DashboardNav';
import { PageDoodles } from '@/lib/ui/PageDoodles';

async function signOutAction() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
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
  if (user) {
    role = await ensureUserProfile(supabase, user.id);
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F7F4EF' }}>
      <DashboardSidebar role={role} userEmail={user?.email ?? null} signOutAction={signOutAction} />
      <main className="relative flex-1 min-w-0 px-6 md:px-10 py-8">
        <PageDoodles />
        <div className="relative max-w-4xl mx-auto animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
