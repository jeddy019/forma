import { SkeletonBar, SkeletonCard } from '@/lib/ui/Skeleton';

export default function MarkingDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-48" />
        <SkeletonBar className="h-4 w-72" />
      </div>
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i}>
          <SkeletonBar className="h-4 w-16" />
          <SkeletonBar className="h-4 w-full" />
          <SkeletonBar className="h-4 w-2/3" />
          <SkeletonBar className="h-8 w-32" />
        </SkeletonCard>
      ))}
    </div>
  );
}
