import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureUserProfile } from '@/lib/supabase/ensureUserProfile';

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
  if (user) {
    await ensureUserProfile(supabase, user.id);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#E0D9D0]">
        <Link href="/dashboard/students" className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-playfair)' }}>
          Forma
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/dashboard/students" className="text-sm text-[#5C5849]">
            Students
          </Link>
          {user && <span className="text-sm text-[#9A9080]">{user.email}</span>}
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-[#5C5849]">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <main className="px-6 py-8 max-w-4xl mx-auto">{children}</main>
    </div>
  );
}
