import type { LucideIcon } from 'lucide-react';

// The one primary-action form per page (accentCardClass - add a student,
// create a schedule, add a session note, new template) opened with a bare
// <h2> or, in SessionNotesForm's case, just a field label doing double duty
// as a title - no visual anchor, which is exactly the "flat" complaint
// PageHeader.tsx already fixed for page titles (see Design System v2 above)
// just never extended to the form itself. Same icon-badge language as
// PageHeader, sized down (w-9 vs w-11, text-lg vs text-xl) since this sits
// nested inside a card rather than at the top of the page.
export function FormHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-[#FEF9EC] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-[#C8A84B]" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-[#1A1A18]">{title}</h2>
    </div>
  );
}
