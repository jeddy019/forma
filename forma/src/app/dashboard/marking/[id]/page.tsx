import { notFound } from 'next/navigation';
import { cardClass } from '@/lib/ui/formStyles';
import { loadMarkingDetail } from '@/lib/marking/loadMarkingDetail';
import MarkingForm from './MarkingForm';

// Full desktop review screen. Data assembly (auth, tutor-pro gating, RLS
// ownership via the joined worksheet, speed flags, question/scheme/tier
// merging) lives in the shared loadMarkingDetail() - the R4 quick-marking
// route consumes the exact same context so the two screens can't drift.
export default async function MarkingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadMarkingDetail(id);

  if (result.kind === 'forbidden') {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Marking dashboard</h1>
        <p className="text-sm text-[#5C5849]">The marking dashboard is available on the Tutor plan.</p>
      </div>
    );
  }
  if (result.kind === 'missing') notFound();

  const ctx = result.context;
  return (
    <MarkingForm
      submissionId={ctx.submissionId}
      studentName={ctx.studentName}
      subject={ctx.subject}
      topic={ctx.topic}
      submittedAt={ctx.submittedAt}
      scorePercentage={ctx.scorePercentage}
      reviewed={ctx.reviewed}
      existingFeedback={ctx.existingFeedback}
      questions={ctx.questions}
      timeTakenSeconds={ctx.timeTakenSeconds}
      speedFlag={ctx.speedFlag}
    />
  );
}
