import { SkeletonBar, SkeletonCard } from '@/lib/ui/Skeleton';

export default function FamiliesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-40" />
        <SkeletonBar className="h-4 w-80" />
      </div>
      <SkeletonCard>
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-10 w-1/2" />
      </SkeletonCard>
      <div className="flex flex-col gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 flex flex-col gap-3">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-3 w-56" />
            <div className="border-t border-[#E0D9D0] pt-3 flex flex-col gap-2">
              <SkeletonBar className="h-4 w-36" />
              <SkeletonBar className="h-5 w-32" />
              <SkeletonBar className="h-5 w-44" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}