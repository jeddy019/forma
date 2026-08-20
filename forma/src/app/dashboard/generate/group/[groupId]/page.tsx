import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';

interface WorksheetRow {
  id: string;
  student_id: string;
  digital_code: string;
  subject: string;
  topic: string;
  alignment_note: string | null;
  created_at: string;
  student: { name: string } | null;
}

interface SubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
}

export default async function GroupComparisonPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Permissions Summary: group mode is tutor-pro only, same gate as the
  // generation endpoint that created this group in the first place.
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (ownerRow?.role !== 'tutor' || !isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at)) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Group results</h1>
        <p className="text-sm text-[#5C5849]">Group mode is available on the Tutor plan.</p>
      </div>
    );
  }

  // RLS (worksheets_own) scopes this to the tutor's own worksheets already -
  // a different tutor's groupId simply returns no rows here.
  const { data: worksheets } = await supabase
    .from('worksheets')
    .select('id, student_id, digital_code, subject, topic, alignment_note, created_at, student:student_profiles(name)')
    .eq('group_id', groupId)
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .returns<WorksheetRow[]>();

  if (!worksheets || worksheets.length === 0) notFound();

  // Latest submission per worksheet - a student could theoretically submit
  // more than once, so this isn't a bare 1:1 join. Same "batch query, then
  // reduce in JS" shape as the Monday summary cron's own per-student
  // aggregation, just simpler (no averaging/topic-picking logic here, so
  // it doesn't warrant its own pure-function file the way that did).
  const worksheetIds = worksheets.map((w) => w.id);
  const { data: submissions } = await supabase
    .from('submissions')
    .select('worksheet_id, score_percentage, submitted_at')
    .in('worksheet_id', worksheetIds)
    .order('submitted_at', { ascending: false })
    .returns<SubmissionRow[]>();

  const latestSubmissionByWorksheet = new Map<string, SubmissionRow>();
  for (const submission of submissions ?? []) {
    if (!latestSubmissionByWorksheet.has(submission.worksheet_id)) {
      latestSubmissionByWorksheet.set(submission.worksheet_id, submission);
    }
  }

  const first = worksheets[0];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard/generate" className="text-sm text-[#5C5849]">
          New
        </Link>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1 mt-1">
          {first.subject} - {first.topic}
        </h1>
        {first.alignment_note && <p className="text-xs italic text-[#9A9080]">{first.alignment_note}</p>}
        <p className="text-sm text-[#5C5849] mt-1">{worksheets.length} students in this group</p>
      </div>

      <div className="flex flex-col gap-3">
        {worksheets.map((worksheet) => {
          const submission = latestSubmissionByWorksheet.get(worksheet.id);
          return (
            <div
              key={worksheet.id}
              className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">{worksheet.student?.name ?? 'Unknown student'}</p>
                <a
                  href={`${appUrl}/s/${worksheet.digital_code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#1A3D2E]"
                >
                  {appUrl}/s/{worksheet.digital_code}
                </a>
              </div>
              <div className="text-right">
                {submission?.score_percentage != null ? (
                  <p className="text-sm font-medium text-[#1A3D2E]">{submission.score_percentage}%</p>
                ) : (
                  <p className="text-xs text-[#9A9080] italic">Not submitted yet</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
