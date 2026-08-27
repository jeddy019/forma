import { PageHeader } from '@/lib/ui/PageHeader';
import { SkeletonCard } from '@/lib/ui/Skeleton';
import { BarChart3 } from 'lucide-react';

// Performance Rule 4: skeleton, never a blank screen, while mastery loads.
export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={BarChart3} title="Mastery" subtitle="Colour-coded class progress - green is secure, red needs work." />
      <SkeletonCard>
        <span className="sr-only">Loading class mastery…</span>
      </SkeletonCard>
    </div>
  );
}
