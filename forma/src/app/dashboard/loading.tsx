import { SkeletonBar, SkeletonCard } from '@/lib/ui/Skeleton';

export default function DashboardHomeLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-44" />
        <SkeletonBar className="h-4 w-80" />
      </div>
      <SkeletonCard>
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-5 w-3/4" />
        <SkeletonBar className="h-5 w-2/3" />
        <SkeletonBar className="h-5 w-1/2" />
        <SkeletonBar className="h-10 w-40" />
      </SkeletonCard>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-4 flex flex-col gap-2">
            <SkeletonBar className="h-5 w-10" />
            <SkeletonBar className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}