import { SkeletonBar, SkeletonCard } from '@/lib/ui/Skeleton';

export default function GenerateLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-56" />
        <SkeletonBar className="h-4 w-64" />
      </div>
      <SkeletonCard>
        <SkeletonBar className="h-4 w-20" />
        <SkeletonBar className="h-10 w-full" />
        <SkeletonBar className="h-4 w-40" />
        <SkeletonBar className="h-20 w-full" />
        <SkeletonBar className="h-10 w-40" />
      </SkeletonCard>
    </div>
  );
}
