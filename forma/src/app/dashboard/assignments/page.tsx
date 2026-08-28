import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass, interactiveCardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { EmptyState } from '@/lib/ui/EmptyState';
import { PageHeader } from '@/lib/ui/PageHeader';
import { CalendarRange } from 'lucide-react';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface AssignmentListRow {
  id: string;
  title: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
  worksheets: { id: string }[];
}

interface WorksheetForCount {
  id: string;
  assignment_id: string;
  submissions: { id: string }[];
}

// Phase B Wave 5 (B73): Assignment loop - the tutor-facing aggregation layer.
// Group mode generates N worksheets; this page presents those batches as one
// named assignment with a live per-student status. Detail lives at
// /dashboard/assignments/[id]; the marking queue remains the per-submission
// deep work. RLS (assignments_own) scopes every query to the tutor's own rows.
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Same gate as group generation itself - assignments are a tutor-pro
  // entitlement (Permissions Summary lists group mode under TUTOR only).
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Assignments</h1>
        <p className="text-sm text-[#5C5849]">Assignments are available on the Tutor plan.</p>
      </div>
    );
  }

  const {
    data: assignments,
    count,
    error,
  } = await supabase
    .from('assignments')
    .select('id, title, subject, topic, created_at, worksheets:worksheets(id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<AssignmentListRow[]>();

  // Submitted counts: batch-load the worksheets of this page's assignments,
  // then their submissions, and count distinct worksheets that have one.
  const worksheets: WorksheetForCount[] = [];
  if (assignments?.length) {
    const assignmentIds = assignments.map((a) => a.id);
    const { data: ws } = await supabase
      .from('worksheets')
      .select('id, assignment_id, submissions:submissions(id)')
      .in('assignment_id', assignmentIds)
      .returns<WorksheetForCount[]>();
    worksheets.push(...(ws ?? []));
  }

  const submittedByAssignment = new Map<string, number>();
  for (const worksheet of worksheets) {
    const submitted = worksheet.submissions.length > 0;
    if (submitted) {
      submittedByAssignment.set(worksheet.assignment_id, (submittedByAssignment.get(worksheet.assignment_id) ?? 0) + 1);
    }
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={CalendarRange} title="Assignments" subtitle="What you&apos;ve set for your students, and where each one stands." />

      <div className="flex flex-col gap-3">
        {error && <p className="text-sm text-[#C0392B]">Could not load assignments - please refresh.</p>}
        {!error && assignments?.length === 0 && (
          <EmptyState
            icon={CalendarRange}
            message="No assignments yet - create one for multiple students in New."
            actionLabel="New assignment"
            actionHref="/dashboard/generate"
          />
        )}
        {assignments?.map((assignment) => {
          const studentCount = assignment.worksheets.length;
          const submittedCount = submittedByAssignment.get(assignment.id) ?? 0;
          const allSubmitted = studentCount > 0 && submittedCount === studentCount;
          return (
            <Link
              key={assignment.id}
              href={`/dashboard/assignments/${assignment.id}`}
              className={`${interactiveCardClass} p-4 flex items-center justify-between gap-4`}
            >
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">{assignment.title}</p>
                <p className="text-xs text-[#9A9080]">
                  {assignment.subject ?? ''}
                  {assignment.topic ? ` - ${assignment.topic}` : ''} - {new Date(assignment.created_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-[#5C5849]">
                  {submittedCount}/{studentCount} submitted
                </span>
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                    allSubmitted ? 'bg-[#E8F2ED] text-[#1A3D2E]' : 'bg-[#FEF9EC] text-[#B8963C]'
                  }`}
                >
                  {allSubmitted ? 'Complete' : 'In progress'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
          {page > 1 && (
            <a href={`/dashboard/assignments?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
              Previous
            </a>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/dashboard/assignments?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}