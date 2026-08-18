import { SkeletonBar } from '@/lib/ui/Skeleton';

export default function GroupComparisonLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-3 w-20" />
        <SkeletonBar className="h-6 w-64" />
        <SkeletonBar className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <SkeletonBar className="h-4 w-28" />
              <SkeletonBar className="h-3 w-48" />
            </div>
            <SkeletonBar className="h-5 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
