import { SkeletonBar, SkeletonCard } from '@/lib/ui/Skeleton';

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-xl">
      <div className="flex flex-col gap-2">
        <SkeletonBar className="h-6 w-32" />
        <SkeletonBar className="h-4 w-56" />
      </div>
      <SkeletonCard>
        <SkeletonBar className="h-4 w-24" />
        <SkeletonBar className="h-4 w-40" />
        <SkeletonBar className="h-10 w-36" />
      </SkeletonCard>
    </div>
  );
}
