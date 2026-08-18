import { SkeletonBar, SkeletonCard } from '@/lib/ui/Skeleton';

export default function StudentDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-6 w-48" />
        <SkeletonBar className="h-4 w-32" />
      </div>
      <div className="flex flex-col gap-3">
        <SkeletonBar className="h-5 w-40" />
        {[1, 2].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-center justify-between gap-4">
            <SkeletonBar className="h-4 w-32" />
            <SkeletonBar className="h-4 w-16" />
          </div>
        ))}
      </div>
      <SkeletonCard>
        <SkeletonBar className="h-4 w-32" />
        <SkeletonBar className="h-16 w-full" />
      </SkeletonCard>
    </div>
  );
}
