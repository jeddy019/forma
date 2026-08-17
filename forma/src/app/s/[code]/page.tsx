import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WorksheetQuestion } from '@/lib/pdf/worksheet-template';
import StudentWorksheetForm from './StudentWorksheetForm';

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
  questions_json: {
    curriculum: string;
    year_level: string;
    questions: WorksheetQuestion[];
  };
}

const cardClass =
  'bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]';

export default async function StudentWorksheetPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const admin = createAdminClient();
  const { data: worksheet } = await admin
    .from('worksheets')
    .select('id, digital_code, subject, topic, alignment_note, expires_at, questions_json')
    .eq('digital_code', code)
    .single<WorksheetRow>();

  if (!worksheet) notFound();

  const isExpired = worksheet.expires_at !== null && new Date(worksheet.expires_at) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#F7F4EF' }}>
        <div className={`${cardClass} max-w-md text-center`}>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
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

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-playfair)' }}>
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

        <StudentWorksheetForm digitalCode={worksheet.digital_code} questions={questions} />
      </div>
    </div>
  );
}
