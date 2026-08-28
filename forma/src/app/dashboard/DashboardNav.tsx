'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, FilePlus, Calendar, ClipboardCheck, LayoutTemplate, BarChart3, CalendarRange, Settings, LogOut, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Design System v3 (Phase 9, Step 51): rebuilt from a horizontal top bar
// into a Linear/Cal.com-style left sidebar - the user chose this over a
// denser top bar specifically because it's the more authentic match to
// those references (icon+label list, out of the reading column) rather
// than a lower-risk cosmetic tweak. Collapses to icon-only below the md
// breakpoint (same "hide the label, keep the icon" technique the old top
// bar already used) instead of a hamburger/JS toggle - no client state
// needed beyond the usePathname() this component already required.
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; tutorOnly?: boolean }[] = [
  { href: '/dashboard/students', label: 'Students', icon: Users },
  { href: '/dashboard/generate', label: 'New', icon: FilePlus },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/marking', label: 'Marking', icon: ClipboardCheck, tutorOnly: true },
  { href: '/dashboard/assignments', label: 'Assignments', icon: CalendarRange, tutorOnly: true },
  { href: '/dashboard/mastery', label: 'Mastery', icon: BarChart3, tutorOnly: true },
  { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate, tutorOnly: true },
];

// Inactive links were text-secondary (#5C5849) by default - readable, but
// against the sidebar's own #F0EBE3 background it read as dim compared to
// Linear/Cal.com's higher-contrast nav text (confirmed live: the user
// flagged it after actually logging in and looking, not a guess). Default
// state now uses text-primary; active/hover keep their existing distinct
// treatment (accent-tinted background + bold, or a background lift) so the
// hierarchy still reads correctly, it's just not carried by dimness alone
// anymore.
const linkClass = (active: boolean) =>
  `flex items-center justify-center md:justify-start gap-2.5 px-0 md:px-3 py-2 rounded-[8px] text-sm transition-colors duration-micro ease-premium ${
    active ? 'bg-[#E8F2ED] text-[#1A3D2E] font-medium' : 'text-[#1A1A18] hover:bg-[#E5DFD3]'
  }`;

export function DashboardSidebar({
  role,
  userEmail,
  signOutAction,
}: {
  role: string | null;
  userEmail: string | null;
  signOutAction: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-14 md:w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-[#F0EBE3] border-r border-[#E0D9D0]">
      <Link
        href="/dashboard/students"
        className="flex items-center justify-center md:justify-start px-0 md:px-5 h-14 shrink-0 border-b border-[#E0D9D0] text-lg font-semibold text-[#1A3D2E]"
        style={{ fontFamily: 'var(--font-fira)' }}
      >
        <span className="hidden md:inline">Forma</span>
        <span className="md:hidden">F</span>
      </Link>

      <nav className="flex-1 flex flex-col gap-0.5 px-2 md:px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.filter((item) => !item.tutorOnly || role === 'tutor').map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={linkClass(active)} title={item.label}>
              <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          );
        })}

        {/* Step 53: locked placeholder, no route behind it yet - clean, not
            promotional, per the user's own wording for this entry. */}
        <div className="flex flex-col gap-0.5 mt-1 px-0 md:px-3 py-2 rounded-[8px] cursor-default" title="Exam Prep - coming soon">
          <div className="flex items-center justify-center md:justify-start gap-2.5 text-sm text-[#9A9080]">
            <Lock className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden md:inline flex-1">Exam Prep</span>
            <span className="hidden md:inline text-[9px] uppercase tracking-[0.06em] bg-[#E0D9D0] text-[#5C5849] rounded-full px-2 py-[2px]">
              Soon
            </span>
          </div>
          <p className="hidden md:block text-[10px] text-[#9A9080] leading-snug pl-[26px] pr-2">
            Structured revision programmes for GCSE, A-Level, SAT, and more.
          </p>
        </div>
      </nav>

      <div className="px-2 md:px-3 py-3 border-t border-[#E0D9D0] flex flex-col gap-0.5">
        <Link href="/dashboard/settings" className={linkClass(pathname?.startsWith('/dashboard/settings') ?? false)} title="Settings">
          <Settings className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span className="hidden md:inline">Settings</span>
        </Link>
        {userEmail && <p className="hidden md:block text-[11px] text-[#9A9080] px-3 pt-1 truncate">{userEmail}</p>}
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center md:justify-start gap-2.5 px-0 md:px-3 py-2 rounded-[8px] text-sm text-[#1A1A18] hover:bg-[#E5DFD3] transition-colors duration-micro ease-premium"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden md:inline">Sign out</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
