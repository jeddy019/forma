import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { DiagramSpec } from '@/lib/ai/schema';
import { renderRichText } from '@/lib/render/richText';
import { resolveBranding } from '@/lib/branding';
import StudentWorksheetForm from './StudentWorksheetForm';

// Student-safe question shape: questions_json is already answer-free
// (splitMarkScheme.ts moves answer/answer_format/mark_scheme into
// mark_scheme_json), and this adds textHtml - the part text pre-rendered
// SERVER-side through the exact same rich-text pipeline the PDF uses
// (KaTeX math, fenced code panels, escaped prose). Rendering here rather
// than in the client component means zero KaTeX JavaScript reaches the
// student's browser bundle - print and digital are guaranteed to interpret
// AI output identically because it is literally the same function.
export interface StudentQuestionPart {
  part_label: string | null;
  marks: number;
  diagram_spec: DiagramSpec | null;
  textHtml: string;
}

export interface StudentQuestion {
  id: string;
  type: 'warm-up' | 'core' | 'challenge';
  parts: StudentQuestionPart[];
}

// Security Rules 1 / Routing Structure: this route has no auth and must
// never expose mark_scheme_json - it selects only student-safe columns via
// the service_role client (RLS has no anon-visible SELECT policy on
// worksheets at all, by design - see schema.sql). year_level isn't its own
// worksheets column (it lives inside questions_json, spread in from the AI
// response by splitMarkScheme.ts), so it isn't in this select list even
// though CLAUDE.md's Routing Structure names it - it's read from the JSON
// blob below instead. expires_at is additionally selected (added in this
// same step) to enforce the 30-day link expiry - safe to expose, it carries
// no worksheet content.
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
      parts: Array<{
        part_label: string | null;
        text: string;
        marks: number;
        diagram_spec: DiagramSpec | null;
      }>;
    }>;
  };
}

// Kept local rather than importing formStyles.ts's cardClass, same
// deliberate reasoning as StudentWorksheetForm.tsx (this route is the one
// place in the app with zero auth) - but the actual values had drifted from
// it: still the pre-Phase-8 0.5px border and an ad hoc shadow value, missed
// when the rest of the app's card/shadow contrast was fixed. Corrected to
// match (1px border, shadow-card) - confirmed live this page read flatter
// than the rest of the app for exactly that reason.
const cardClass = 'bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card';

export default async function StudentWorksheetPage({
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

  // W1 identity layer: the student's page carries the OWNER's brand, not
  // the platform's (FOUNDER'S PERSONAL MODEL) - resolve it from the
  // worksheet's owner, falling back to Forma when unset/unknown so the
  // page still renders for legacy rows with no owner at all.
  const { data: ownerRow } = await admin
    .from('users')
    .select('brand_name, brand_accent')
    .eq('id', worksheet.owner_id ?? '')
    .maybeSingle<{ brand_name: string | null; brand_accent: string | null }>();
  const brand = resolveBranding(ownerRow);

  // Phase 7 Step 39 (Speed awareness): "started working on it" event,
  // captured once - first view wins, every later view of the same link
  // (including the student navigating back to it) leaves it untouched.
  // Awaited, not fire-and-forget: a real bug caught live in this session -
  // an un-awaited update here never actually landed, because Next.js (and
  // especially a real serverless deployment) can tear down the request
  // once the response starts, killing any promise nobody was still
  // waiting on. This is one small, fast, indexed single-row update -
  // cheap enough to await - wrapped in try/catch so a failure still can't
  // break the student actually seeing their worksheet.
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
          <p className="text-sm text-[#5C5849]">Ask your tutor to resend the worksheet link.</p>
        </div>
      </div>
    );
  }

  const { curriculum, year_level, questions } = worksheet.questions_json;
  const alignmentNoteText =
    worksheet.alignment_note ?? `Questions are appropriate for ${curriculum} ${worksheet.subject}.`;

  const studentQuestions: StudentQuestion[] = questions.map((question) => ({
    id: question.id,
    type: question.type,
    parts: question.parts.map((part) => ({
      part_label: part.part_label,
      marks: part.marks,
      diagram_spec: part.diagram_spec,
      textHtml: renderRichText(part.text),
    })),
  }));

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
              {brand.name}
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

        <StudentWorksheetForm digitalCode={worksheet.digital_code} questions={studentQuestions} />
      </div>
    </div>
  );
}
