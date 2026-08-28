import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DiagramSpec } from '@/lib/ai/schema';
import { renderRichText } from '@/lib/render/richText';
import { aiTutorAllowance } from '@/lib/payments/planStatus';
import QuizForm from './QuizForm';

export interface QuizQuestionPart {
  part_label: string | null;
  marks: number;
  diagram_spec: DiagramSpec | null;
  textHtml: string;
}

export interface QuizQuestion {
  id: string;
  type: 'warm-up' | 'core' | 'challenge';
  // Phase B Wave 1 (B10): the canonical sub-skill this question targets,
  // needed client-side so the review phase can map which sub-skills were got
  // wrong and drive "Re-practice wrong answers". Not answer-revealing.
  sub_skill: string;
  parts: QuizQuestionPart[];
}

interface WorksheetRow {
  id: string;
  digital_code: string;
  subject: string;
  topic: string;
  alignment_note: string | null;
  expires_at: string | null;
  first_opened_at: string | null;
  owner_id: string | null;
  questions_json: {
    curriculum: string;
    year_level: string;
    questions: Array<{
      id: string;
      type: 'warm-up' | 'core' | 'challenge';
      sub_skill: string;
      parts: Array<{
        part_label: string | null;
        text: string;
        marks: number;
        diagram_spec: DiagramSpec | null;
      }>;
    }>;
  };
}

const cardClass = 'bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card';

export default async function QuizPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const admin = createAdminClient();
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('id, digital_code, subject, topic, alignment_note, expires_at, first_opened_at, owner_id, questions_json')
    .eq('digital_code', code)
    .single<WorksheetRow>();

  if (!worksheet) notFound();

  if (!worksheet.first_opened_at) {
    try {
      await admin
        .from('worksheets')
        .update({ first_opened_at: new Date().toISOString() })
        .eq('id', worksheet.id)
        .is('first_opened_at', null);
    } catch (error) {
      console.error('Failed to record first_opened_at', error);
    }
  }

  const isExpired = worksheet.expires_at !== null && new Date(worksheet.expires_at) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#F7F4EF' }}>
        <div className={`${cardClass} max-w-md text-center`}>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-2" style={{ fontFamily: 'var(--font-fira)' }}>
            This link has expired
          </h1>
          <p className="text-sm text-[#5C5849]">Ask your tutor for a new quiz link.</p>
        </div>
      </div>
    );
  }

  const { curriculum, year_level, questions } = worksheet.questions_json;
  const alignmentNoteText =
    worksheet.alignment_note ?? `Questions are appropriate for ${curriculum} ${worksheet.subject}.`;

  // Phase B Wave 4 (B72): AI tutor entitlement is the WORKSHEET OWNER's plan
  // (Pro unlimited, Basic 5/quiz, Free none), resolved server-side the same
  // way the /api/quiz/explain route re-verifies it - never from the browser.
  // The UI shows the chat affordance only when the owner can actually get an
  // answer; the route independently enforces the same gate and the per-quiz
  // cap, so the two cannot drift.
  const { data: ownerRow } = await admin
    .from('users')
    .select('plan, plan_expires_at')
    .eq('id', worksheet.owner_id ?? '')
    .maybeSingle<{ plan: string | null; plan_expires_at: string | null | undefined }>();
  const aiTutorEnabled = aiTutorAllowance(ownerRow?.plan, ownerRow?.plan_expires_at) > 0;

  const quizQuestions: QuizQuestion[] = questions.map((question) => ({
    id: question.id,
    type: question.type,
    sub_skill: question.sub_skill ?? '',
    parts: question.parts.map((part) => ({
      part_label: part.part_label,
      marks: part.marks,
      diagram_spec: part.diagram_spec,
      textHtml: renderRichText(part.text),
    })),
  }));

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
              Forma
            </span>
          </div>
          <hr className="border-t-2 border-[#1A3D2E] mb-3" />
          <div className="flex flex-wrap gap-2 mb-2">
            {[curriculum, year_level, worksheet.subject].map((badge) => (
              <span
                key={badge}
                className="bg-[#E8F2ED] text-[#1A3D2E] text-[9px] font-medium uppercase tracking-wider rounded-full px-2.5 py-1"
              >
                {badge}
              </span>
            ))}
          </div>
          <p className="text-[11px] italic text-[#9A9080] mb-1">{alignmentNoteText}</p>
          <p className="text-sm text-[#5C5849]">{worksheet.topic}</p>
        </div>

        <QuizForm digitalCode={worksheet.digital_code} questions={quizQuestions} aiTutorEnabled={aiTutorEnabled} />
      </div>
    </div>
  );
}
