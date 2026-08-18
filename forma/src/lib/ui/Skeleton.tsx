// Design System v2 loading-state primitives. Performance Rule 4 already
// specifies "Tailwind animate-pulse skeleton" - these compose that into
// the two shapes every route's loading.tsx actually needs (a bar, and a
// card-shaped block matching cardClass's own dimensions from
// formStyles.ts), so each loading.tsx can roughly match its real page's
// layout per the streaming best practice (skeleton dimensions matching
// the real content avoids layout shift once it resolves) without
// hand-rolling the same pulsing-div markup in every route.

export function SkeletonBar({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[6px] bg-[#E0D9D0] ${className}`} />;
}

export function SkeletonCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-6 flex flex-col gap-3">
      {children ?? (
        <>
          <SkeletonBar className="h-4 w-1/3" />
          <SkeletonBar className="h-3 w-1/2" />
        </>
      )}
    </div>
  );
}
