import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/supabase/ensureUserProfile';
import { DashboardNav } from './DashboardNav';

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
    await ensureUserProfile(supabase, user.id);
    const { data: ownerRow } = await supabase.from('users').select('role').eq('id', user.id).single();
    role = ownerRow?.role ?? null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[#E0D9D0] bg-[#F7F4EF]/95 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/dashboard/students" className="text-lg font-semibold text-[#1A3D2E] shrink-0" style={{ fontFamily: 'var(--font-playfair)' }}>
          Forma
        </Link>
        <DashboardNav role={role} />
        <div className="flex items-center gap-3 shrink-0">
          {user && <span className="hidden lg:inline text-xs text-[#9A9080]">{user.email}</span>}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm text-[#5C5849] hover:bg-[#F0EBE3] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </form>
        </div>
      </header>
      <main className="px-6 py-8 max-w-4xl mx-auto animate-fade-up">{children}</main>
    </div>
  );
}
