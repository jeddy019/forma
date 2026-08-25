import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isActivePro } from '@/lib/payments/planStatus';
import { computeSpeedFlag, type TimedSubmission, type SpeedFlag } from '@/lib/marking/speedAwareness';
import { renderRichText } from '@/lib/render/richText';

// Shared server-side loader for both marking surfaces - the full desktop
// review (/dashboard/marking/[id]) and the R4 phone-first quick flow
// (/dashboard/marking/[id]/quick). Extracted rather than duplicated so the
// two screens can never disagree about ownership, entitlement, speed flags,
// or how questions_json/mark_scheme_json/tier results are merged.
//
// RLS (worksheets_own, profiles_own, submissions_owner) enforces ownership
// on every table in the join below - a submission belonging to another
// tutor's worksheet simply doesn't come back, so "doesn't exist" and "isn't
// yours" both surface as the same 'missing' result rather than leaking
// which case it was.

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
    id: string;
    subject: string;
    topic: string;
    first_opened_at: string | null;
    questions_json: { questions: { id: string; type: string; parts: QuestionsJsonPart[] }[] };
    mark_scheme_json: { questions: { id: string; parts: MarkSchemeJsonPart[] }[] } | null;
  } | null;
  student: { name: string } | null;
}

interface PeerWorksheetRow {
  id: string;
  first_opened_at: string | null;
}

interface PeerSubmissionRow {
  worksheet_id: string;
  submitted_at: string;
}

// The shared merged-part shape consumed by both UIs. textHtml carries the
// question text pre-rendered through the same renderRichText pipeline as
// the PDF and the student page, so maths/code display is identical
// everywhere (added during R3/R4 - the old raw-text rendering showed
// literal "$x^2$" once the AI started producing LaTeX).
export interface MergedPart {
  partLabel: string | null;
  text: string;
  textHtml: string;
  marks: number;
  studentAnswer: string;
  answered: boolean;
  isExtended: boolean;
  correctAnswer: string | null;
  markScheme: { M1: string; A1: string; allow: string; commonError: string } | null;
  tier1: { matched: boolean; marksAwarded: number } | null;
  aiSuggestion: { marks_awarded: number; reasoning: string; confidence: 'low' | 'medium' | 'high' } | null;
  existingTutorMark: number | null;
}

export interface MergedQuestion {
  id: string;
  type: string;
  parts: MergedPart[];
}

export interface MarkingDetailContext {
  submissionId: string;
  studentName: string;
  subject: string;
  topic: string;
  submittedAt: string;
  scorePercentage: number | null;
  reviewed: boolean;
  existingFeedback: string | null;
  timeTakenSeconds: number | null;
  speedFlag: SpeedFlag;
  questions: MergedQuestion[];
}

export type LoadMarkingDetailResult =
  | { kind: 'forbidden' }
  | { kind: 'missing' }
  | { kind: 'ok'; context: MarkingDetailContext };

export async function loadMarkingDetail(submissionId: string): Promise<LoadMarkingDetailResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return { kind: 'forbidden' };
  }

  const { data: submission } = await supabase
    .from('submissions')
    .select(
      'id, submitted_at, answers_json, auto_marks_json, ai_suggested_marks_json, tutor_marks_json, tutor_feedback, score_percentage, worksheet:worksheets(id, subject, topic, first_opened_at, questions_json, mark_scheme_json), student:student_profiles(name)'
    )
    .eq('id', submissionId)
    .single<SubmissionRow>();

  if (!submission || !submission.worksheet) {
    return { kind: 'missing' };
  }

  const { worksheet } = submission;

  // Phase 7 Step 39 (Speed awareness): time taken = submitted_at -
  // first_opened_at. "Peers" for the slow-flag comparison are other scored
  // submissions on the tutor's own worksheets sharing this exact
  // subject+topic - RLS (worksheets_own) already scopes the first query to
  // this tutor, so no explicit owner_id filter is needed here.
  const timeTakenSeconds = worksheet.first_opened_at
    ? Math.round((new Date(submission.submitted_at).getTime() - new Date(worksheet.first_opened_at).getTime()) / 1000)
    : null;

  const { data: peerWorksheets } = await supabase
    .from('worksheets')
    .select('id, first_opened_at')
    .eq('subject', worksheet.subject)
    .eq('topic', worksheet.topic)
    .neq('id', worksheet.id)
    .returns<PeerWorksheetRow[]>();

  const peerWorksheetIds = (peerWorksheets ?? []).map((w) => w.id);
  const { data: peerSubmissions } = peerWorksheetIds.length
    ? await supabase.from('submissions').select('worksheet_id, submitted_at').in('worksheet_id', peerWorksheetIds).returns<PeerSubmissionRow[]>()
    : { data: [] as PeerSubmissionRow[] };

  const firstOpenedByWorksheetId = new Map((peerWorksheets ?? []).map((w) => [w.id, w.first_opened_at]));
  const peers: TimedSubmission[] = (peerSubmissions ?? []).map((s) => {
    const openedAt = firstOpenedByWorksheetId.get(s.worksheet_id);
    return {
      worksheetId: s.worksheet_id,
      timeTakenSeconds: openedAt ? Math.round((new Date(s.submitted_at).getTime() - new Date(openedAt).getTime()) / 1000) : null,
    };
  });

  const speedFlag = computeSpeedFlag({ worksheetId: worksheet.id, timeTakenSeconds, scorePercentage: submission.score_percentage }, peers);
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
          textHtml: renderRichText(part.text),
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

  return {
    kind: 'ok',
    context: {
      submissionId: submission.id,
      studentName: submission.student?.name ?? 'Student',
      subject: worksheet.subject,
      topic: worksheet.topic,
      submittedAt: submission.submitted_at,
      scorePercentage: submission.score_percentage,
      reviewed: submission.tutor_marks_json !== null,
      existingFeedback: submission.tutor_feedback,
      timeTakenSeconds,
      speedFlag,
      questions: mergedQuestions,
    },
  };
}
