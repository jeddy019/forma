import { SkeletonBar } from '@/lib/ui/Skeleton';

export default function AssignmentDetailLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-48" />
        <SkeletonBar className="h-4 w-72" />
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <SkeletonBar className="h-4 w-36" />
              <SkeletonBar className="h-3 w-24" />
            </div>
            <SkeletonBar className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}