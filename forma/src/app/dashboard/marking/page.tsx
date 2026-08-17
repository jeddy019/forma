import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface SubmissionListRow {
  id: string;
  submitted_at: string;
  score_percentage: number | null;
  tutor_marks_json: unknown | null;
  worksheet: { subject: string; topic: string } | null;
  student: { name: string } | null;
}

export default async function MarkingPage({
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

  // Permissions Summary: the marking dashboard is a tutor-pro entitlement -
  // free tier and the parent plan don't get it, same gate as mark scheme PDFs.
  const { data: ownerRow } = await supabase.from('users').select('role, plan').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || ownerRow.plan !== 'pro') {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Marking dashboard</h1>
        <p className="text-sm text-[#5C5849]">The marking dashboard is available on the Tutor plan.</p>
      </div>
    );
  }

  // RLS (submissions_owner: worksheets.owner_id = auth.uid() via the joined
  // worksheet) is the real ownership filter here - no need to filter by
  // owner_id explicitly, and there is no such column on submissions anyway.
  const {
    data: submissions,
    count,
    error,
  } = await supabase
    .from('submissions')
    .select(
      'id, submitted_at, score_percentage, tutor_marks_json, worksheet:worksheets(subject, topic), student:student_profiles(name)',
      { count: 'exact' }
    )
    .order('submitted_at', { ascending: false })
    .range(from, to)
    .returns<SubmissionListRow[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Marking</h1>
        <p className="text-sm text-[#5C5849]">Submissions from your students, newest first.</p>
      </div>

      <div className="flex flex-col gap-3">
        {error && <p className="text-sm text-[#C0392B]">Could not load submissions - please refresh.</p>}
        {!error && submissions?.length === 0 && (
          <p className="text-sm text-[#9A9080] italic">No submissions yet.</p>
        )}
        {submissions?.map((submission) => {
          const reviewed = submission.tutor_marks_json !== null;
          return (
            <Link
              key={submission.id}
              href={`/dashboard/marking/${submission.id}`}
              className={`${cardClass} flex items-center justify-between gap-4 hover:border-[#C4B9AC] transition-colors duration-200`}
            >
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">
                  {submission.student?.name ?? 'Student'} - {submission.worksheet?.subject ?? ''}
                </p>
                <p className="text-xs text-[#9A9080]">
                  {submission.worksheet?.topic ?? ''} - {new Date(submission.submitted_at).toLocaleDateString('en-GB')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {reviewed && submission.score_percentage !== null && (
                  <span className="text-sm font-medium text-[#1A3D2E]">{submission.score_percentage}%</span>
                )}
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                    reviewed ? 'bg-[#E8F2ED] text-[#1A3D2E]' : 'bg-[#FEF9EC] text-[#B8963C]'
                  }`}
                >
                  {reviewed ? 'Reviewed' : 'Needs review'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
          {page > 1 && (
            <a href={`/dashboard/marking?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
              Previous
            </a>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/dashboard/marking?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
