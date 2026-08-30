import { SkeletonBar } from '@/lib/ui/Skeleton';

export default function StudentAnalyticsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-40" />
        <SkeletonBar className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex flex-col gap-2">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <SkeletonBar className="h-4 w-40" />
              <SkeletonBar className="h-3 w-32" />
            </div>
            <SkeletonBar className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
