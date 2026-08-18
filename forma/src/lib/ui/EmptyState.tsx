import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { secondaryButtonClass } from './formStyles';

// Design System v2's empty-state pattern: a small line icon (lucide,
// muted colour, never decorative) + message + optional action, replacing
// the bare italic "No X yet" text used identically across ~8 list pages.
// Built as foundation this session; swapping it into those existing
// pages is Phase 4 (see CLAUDE.md's Design System v2 section) - not done
// here yet.
export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center animate-fade-up">
      <Icon className="w-6 h-6 text-[#9A9080]" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-sm text-[#9A9080]">{message}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={secondaryButtonClass}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
