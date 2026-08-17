import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import MarkingForm, { type MergedQuestion } from './MarkingForm';

interface Tier1PartResult {
  matched: boolean;
  marks_awarded: number;
}

interface Tier2PartResult {
  marks_awarded: number;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
  needs_review: boolean;
}

interface QuestionsJsonPart {
  part_label: string | null;
  text: string;
  marks: number;
}

interface MarkSchemeJsonPart {
  part_label: string | null;
  marks: number;
  answer: string;
  answer_format: string;
  M1: string;
  A1: string;
  common_error: string;
  allow: string;
}

interface SubmissionRow {
  id: string;
  submitted_at: string;
  answers_json: Record<string, string[]> | null;
  auto_marks_json: Record<string, (Tier1PartResult | null)[]> | null;
  ai_suggested_marks_json: Record<string, (Tier2PartResult | null)[]> | null;
  tutor_marks_json: Record<string, (number | null)[]> | null;
  tutor_feedback: string | null;
  score_percentage: number | null;
  worksheet: {
    subject: string;
    topic: string;
    questions_json: { questions: { id: string; type: string; parts: QuestionsJsonPart[] }[] };
    mark_scheme_json: { questions: { id: string; parts: MarkSchemeJsonPart[] }[] } | null;
  } | null;
  student: { name: string } | null;
}

export default async function MarkingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Marking dashboard</h1>
        <p className="text-sm text-[#5C5849]">The marking dashboard is available on the Tutor plan.</p>
      </div>
    );
  }

  // RLS (worksheets_own, profiles_own, submissions_owner) enforces ownership
  // on every table in this join - a submission belonging to another tutor's
  // worksheet simply doesn't come back, so "doesn't exist" and "isn't yours"
  // both surface as the same notFound() rather than leaking which case it was.
  const { data: submission } = await supabase
    .from('submissions')
    .select(
      'id, submitted_at, answers_json, auto_marks_json, ai_suggested_marks_json, tutor_marks_json, tutor_feedback, score_percentage, worksheet:worksheets(subject, topic, questions_json, mark_scheme_json), student:student_profiles(name)'
    )
    .eq('id', id)
    .single<SubmissionRow>();

  if (!submission || !submission.worksheet) {
    notFound();
  }

  const { worksheet } = submission;
  const markSchemeByQuestionId = new Map(
    (worksheet.mark_scheme_json?.questions ?? []).map((q) => [q.id, q.parts] as const)
  );

  const mergedQuestions: MergedQuestion[] = worksheet.questions_json.questions.map((question) => {
    const markSchemeParts = markSchemeByQuestionId.get(question.id) ?? [];
    const studentParts = submission.answers_json?.[question.id] ?? [];
    const tier1Parts = submission.auto_marks_json?.[question.id] ?? [];
    const tier2Parts = submission.ai_suggested_marks_json?.[question.id] ?? [];
    const tutorParts = submission.tutor_marks_json?.[question.id] ?? [];

    return {
      id: question.id,
      type: question.type,
      parts: question.parts.map((part, i) => {
        const markScheme = markSchemeParts[i];
        const isExtended = markScheme?.answer_format === 'extended';
        const studentAnswer = studentParts[i] ?? '';
        const tier1 = tier1Parts[i] ?? null;

        return {
          partLabel: part.part_label,
          text: part.text,
          marks: part.marks,
          studentAnswer,
          answered: studentAnswer.trim() !== '',
          isExtended,
          correctAnswer: markScheme?.answer ?? null,
          markScheme: markScheme
            ? { M1: markScheme.M1, A1: markScheme.A1, allow: markScheme.allow, commonError: markScheme.common_error }
            : null,
          tier1: !isExtended && tier1 ? { matched: tier1.matched, marksAwarded: tier1.marks_awarded } : null,
          aiSuggestion: isExtended && tier2Parts[i] ? tier2Parts[i] : null,
          existingTutorMark: isExtended ? (tutorParts[i] ?? null) : null,
        };
      }),
    };
  });

  return (
    <MarkingForm
      submissionId={submission.id}
      studentName={submission.student?.name ?? 'Student'}
      subject={worksheet.subject}
      topic={worksheet.topic}
      submittedAt={submission.submitted_at}
      scorePercentage={submission.score_percentage}
      reviewed={submission.tutor_marks_json !== null}
      existingFeedback={submission.tutor_feedback}
      questions={mergedQuestions}
    />
  );
}
