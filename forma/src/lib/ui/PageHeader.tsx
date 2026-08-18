import type { LucideIcon } from 'lucide-react';

// Every dashboard page opened with a bare <h1>+<p> - text floating on the
// cream background with nothing to anchor the eye, the same "flat" problem
// as the card contrast fix in formStyles.ts, just for headers instead of
// cards. An icon badge (same visual language as the landing page's
// how-it-works steps) gives every page a consistent visual anchor instead
// of copy-pasting the same two-line JSX block with a different icon in
// six different page files.
export function PageHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-11 h-11 rounded-full bg-[#E8F2ED] flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#1A3D2E]" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">{title}</h1>
        <p className="text-sm text-[#5C5849]">{subtitle}</p>
      </div>
    </div>
  );
}
