import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass, interactiveCardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { PageHeader } from '@/lib/ui/PageHeader';
import { CalendarRange } from 'lucide-react';
import { deriveAssignmentStudentStatus, type AssignmentStudentStatus } from '@/lib/assignments/status';

interface AssignmentRow {
  id: string;
  title: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
}

interface WorksheetRow {
  id: string;
  digital_code: string;
  first_opened_at: string | null;
  student: { name: string } | null;
}

interface SubmissionRow {
  id: string;
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
  tutor_marks_json: unknown | null;
}

// Phase B Wave 5 (B73): per-assignment results. Each row is one student's
// lifecycle through the assignment loop: assigned -> opened (in_progress) ->
// submitted -> reviewed. Status is derived from first_opened_at + latest
// submission via the shared pure helper; links go to the surviving
// /s/[code] (resend) and, once submitted, into the existing marking queue
// screens - marking itself is not rebuilt here.
const STATUS_META: Record<AssignmentStudentStatus, { label: string; pill: string }> = {
  assigned: { label: 'Assigned', pill: 'bg-[#F0EBE3] text-[#5C5849]' },
  in_progress: { label: 'In progress', pill: 'bg-[#FEF9EC] text-[#B8963C]' },
  submitted: { label: 'Submitted', pill: 'bg-[#E8F2ED] text-[#1A3D2E]' },
  reviewed: { label: 'Reviewed', pill: 'bg-[#1A3D2E] text-white' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB');
}

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Same tutor-pro gate as the list page and group mode itself.
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Assignment</h1>
        <p className="text-sm text-[#5C5849]">Assignments are available on the Tutor plan.</p>
      </div>
    );
  }

  // RLS (assignments_own) scopes this to the tutor's own assignment.
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id, title, subject, topic, created_at')
    .eq('id', id)
    .single()
    .returns<AssignmentRow>();
  if (!assignment) notFound();

  const { data: worksheets } = await supabase
    .from('worksheets')
    .select('id, digital_code, first_opened_at, student:student_profiles(name)')
    .eq('assignment_id', assignment.id)
    .order('created_at', { ascending: true })
    .returns<WorksheetRow[]>();
  if (!worksheets || worksheets.length === 0) notFound();

  // Latest submission per worksheet - same batch-then-reduce shape as the
  // group comparison page and Monday summary cron.
  const worksheetIds = worksheets.map((w) => w.id);
  const latestSubmissionByWorksheet = new Map<string, SubmissionRow>();
  if (worksheetIds.length > 0) {
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, worksheet_id, score_percentage, submitted_at, tutor_marks_json')
      .in('worksheet_id', worksheetIds)
      .order('submitted_at', { ascending: false })
      .returns<SubmissionRow[]>();
    for (const submission of submissions ?? []) {
      if (!latestSubmissionByWorksheet.has(submission.worksheet_id)) {
        latestSubmissionByWorksheet.set(submission.worksheet_id, submission);
      }
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const rows = worksheets.map((worksheet) => {
    const latestSubmission = latestSubmissionByWorksheet.get(worksheet.id) ?? null;
    const status = deriveAssignmentStudentStatus(worksheet, latestSubmission);
    return { worksheet, latestSubmission, status };
  });
  const submittedCount = rows.filter((r) => r.status === 'submitted' || r.status === 'reviewed').length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={CalendarRange} title={assignment.title} subtitle="Assignment tracking - status for every student." />

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2.5 py-1">
          {assignment.subject ?? ''}
          {assignment.topic ? ` - ${assignment.topic}` : ''}
        </span>
        <span className="bg-[#F0EBE3] text-[#5C5849] rounded-full px-2.5 py-1">
          Set on {formatDate(assignment.created_at)}
        </span>
        <span className="bg-[#F0EBE3] text-[#5C5849] rounded-full px-2.5 py-1">
          {submittedCount}/{rows.length} submitted
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {rows.map(({ worksheet, latestSubmission, status }) => {
          const meta = STATUS_META[status];
          return (
            <div key={worksheet.id} className={`${interactiveCardClass} p-4 flex items-center justify-between gap-4`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1A18]">{worksheet.student?.name ?? 'Unknown student'}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <a
                    href={`${appUrl}/s/${worksheet.digital_code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#1A3D2E] hover:underline"
                  >
                    Open worksheet link
                  </a>
                  {latestSubmission && (
                    <Link
                      href={`/dashboard/marking/${latestSubmission.id}`}
                      className="text-xs text-[#1A3D2E] hover:underline"
                    >
                      Review submission
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {status === 'reviewed' && latestSubmission?.score_percentage != null && (
                  <span className="text-sm font-medium text-[#1A3D2E]">{latestSubmission.score_percentage}%</span>
                )}
                <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${meta.pill}`}>{meta.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}