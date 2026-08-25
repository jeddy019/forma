import { notFound } from 'next/navigation';
import { cardClass } from '@/lib/ui/formStyles';
import { loadMarkingDetail, type MergedPart } from '@/lib/marking/loadMarkingDetail';
import QuickMarkForm, { type DecisionItem } from './QuickMarkForm';

// R4: the 30-second phone flow. Only "extended" parts the student actually
// answered need a human decision (Tier 1 parts are already auto-marked,
// unanswered parts score zero automatically - saveMarkingAction handles
// both), so this screen shows ONLY those as big tap-target cards and
// nothing else. Saves through the exact same saveMarkingAction as the full
// review screen, so skill_map / adaptive difficulty behave identically.
export default async function QuickMarkingPage({ params }: { params: Promise<{ id: string }> }) {
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

  const items: DecisionItem[] = [];
  let tier1Awarded = 0;
  let tier1Correct = 0;
  let tier1Total = 0;
  let totalMarksAll = 0;
  for (const question of ctx.questions) {
    question.parts.forEach((part: MergedPart, partIndex) => {
      totalMarksAll += part.marks;
      if (part.tier1) {
        tier1Total += 1;
        tier1Awarded += part.tier1.marksAwarded;
        if (part.tier1.matched) tier1Correct += 1;
        return;
      }
      if (!part.isExtended || !part.answered) return;
      items.push({
        key: `${question.id}:${partIndex}`,
        questionId: question.id,
        partIndex,
        partLabel: part.partLabel,
        questionNumber: ctx.questions.indexOf(question) + 1,
        marks: part.marks,
        questionHtml: part.textHtml,
        studentAnswer: part.studentAnswer,
        aiSuggestion: part.aiSuggestion,
        existingTutorMark: part.existingTutorMark,
        scheme: part.markScheme,
        correctAnswer: part.correctAnswer,
      });
    });
  }

  return (
    <QuickMarkForm
      submissionId={ctx.submissionId}
      studentName={ctx.studentName}
      subject={ctx.subject}
      topic={ctx.topic}
      reviewed={ctx.reviewed}
      existingFeedback={ctx.existingFeedback}
      items={items}
      tier1Summary={{ correct: tier1Correct, total: tier1Total }}
      tier1Awarded={tier1Awarded}
      totalMarksAll={totalMarksAll}
    />
  );
}
