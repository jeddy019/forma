'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Sparkles, Calendar, ClipboardCheck, LayoutTemplate, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Design System v2: the dashboard nav was plain text links with no active
// state (every page looked identical in the header regardless of where you
// were). This is a client component only because usePathname needs it -
// DashboardLayout itself stays a server component for the auth/role fetch.
const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; tutorOnly?: boolean }[] = [
  { href: '/dashboard/students', label: 'Students', icon: Users },
  { href: '/dashboard/generate', label: 'Generate', icon: Sparkles },
  { href: '/dashboard/schedule', label: 'Schedule', icon: Calendar },
  { href: '/dashboard/marking', label: 'Marking', icon: ClipboardCheck, tutorOnly: true },
  { href: '/dashboard/templates', label: 'Templates', icon: LayoutTemplate, tutorOnly: true },
];

export function DashboardNav({ role }: { role: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.filter((item) => !item.tutorOnly || role === 'tutor').map((item) => {
        const active = pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm transition-colors duration-micro ease-premium ${
              active ? 'bg-[#E8F2ED] text-[#1A3D2E] font-medium' : 'text-[#5C5849] hover:bg-[#F0EBE3] hover:text-[#1A1A18]'
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden md:inline">{item.label}</span>
          </Link>
        );
      })}
      <Link
        href="/dashboard/settings"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm transition-colors duration-micro ease-premium ${
          pathname?.startsWith('/dashboard/settings')
            ? 'bg-[#E8F2ED] text-[#1A3D2E] font-medium'
            : 'text-[#5C5849] hover:bg-[#F0EBE3] hover:text-[#1A1A18]'
        }`}
      >
        <Settings className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden md:inline">Settings</span>
      </Link>
    </nav>
  );
}
