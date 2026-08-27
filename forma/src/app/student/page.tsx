import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cardClass, interactiveCardClass } from '@/lib/ui/formStyles';
import { EmptyState } from '@/lib/ui/EmptyState';
import MasteryBars from '@/lib/ui/MasteryBars';
import { toMasteryBarsAggregated, masteryScore } from '@/lib/mastery/masteryView';
import type { SkillMap } from '@/lib/mastery/types';
import { BarChart3, FileText, LogOut } from 'lucide-react';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface StudentProfileMatch {
  id: string;
  name: string;
  skill_map: SkillMap | null;
}

interface WorksheetRow {
  id: string;
  student_id: string;
  subject: string;
  topic: string;
  digital_code: string;
  created_at: string;
}

interface SubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
}

async function signOutAction() {
  'use server';
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/student/login');
}

export default async function StudentPortalPage({
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
  // proxy.ts's middleware only protects /dashboard - this route is its
  // own primary auth gate, not a defensive backup like /dashboard pages'
  // own redirect checks are.
  if (!user?.email) redirect('/student/login');

  // Security Rules 1's established pattern (/s/[code], /api/submit):
  // service-role client, explicit safe-column selects only. RLS's
  // profiles_own/worksheets_own policies are keyed to auth.uid() ===
  // owner_id, which a student's own auth account never satisfies (the
  // owner is always their tutor/parent) - RLS cannot express "a student
  // may read their own data" at all under the current policies, so this
  // page authorizes itself in application code instead: match the
  // *verified* Supabase Auth email (never anything client-supplied)
  // against student_profiles.email, same "never trust client-asserted
  // identity" principle as /api/submit not trusting a client-supplied
  // student_id.
  const admin = createAdminClient();
  const { data: matchedStudents } = await admin
    .from('student_profiles')
    .select('id, name, skill_map')
    .ilike('email', user.email)
    .returns<StudentProfileMatch[]>();

  if (!matchedStudents || matchedStudents.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
        <PortalHeader />
        <main className="px-6 py-8 max-w-2xl mx-auto">
          <div className={`${cardClass} text-center`}>
            <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">No worksheets found</h1>
            <p className="text-sm text-[#5C5849]">
              We couldn&apos;t find any worksheets for {user.email}. Ask your tutor or parent to add this email to
              your profile.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // A student's email could plausibly be on file with more than one
  // tutor/parent (or both) - the portal merges everything into one
  // combined history rather than showing separate tabs per profile, only
  // labelling which profile each row belongs to when there's more than one.
  const studentIds = matchedStudents.map((s) => s.id);
  const studentNameById = new Map(matchedStudents.map((s) => [s.id, s.name]));

  const {
    data: worksheets,
    count,
    error: worksheetsError,
  } = await admin
    .from('worksheets')
    .select('id, student_id, subject, topic, digital_code, created_at', { count: 'exact' })
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<WorksheetRow[]>();

  const worksheetIds = (worksheets ?? []).map((w) => w.id);
  const { data: submissions } = worksheetIds.length
    ? await admin
        .from('submissions')
        .select('worksheet_id, score_percentage, submitted_at')
        .in('worksheet_id', worksheetIds)
        .returns<SubmissionRow[]>()
    : { data: [] as SubmissionRow[] };

  const latestSubmissionByWorksheet = new Map<string, SubmissionRow>();
  for (const submission of submissions ?? []) {
    const existing = latestSubmissionByWorksheet.get(submission.worksheet_id);
    if (!existing || submission.submitted_at > existing.submitted_at) {
      latestSubmissionByWorksheet.set(submission.worksheet_id, submission);
    }
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // Phase B Wave 1 (B5): aggregate each matched profile's skill_map into one
  // combined set of mastery bars for the student. skill_map carries only
  // scores/history - no mark scheme - so it is safe to hand to the student
  // (see masteryView.ts / Security Rules 1; the route uses the admin client
  // with verified-email matching, same as the rest of this page).
  const masteryBars = toMasteryBarsAggregated(matchedStudents.map((s) => s.skill_map));
  const overallMastery = masteryScore(masteryBars);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <PortalHeader />
      <main className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Your worksheets</h1>
          <p className="text-sm text-[#5C5849]">{user.email}</p>
        </div>

        <div className={`${cardClass} flex flex-col gap-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#1A3D2E]" strokeWidth={2} aria-hidden="true" />
              <h2 className="text-base font-semibold text-[#1A1A18]">Your progress</h2>
            </div>
            {overallMastery != null && (
              <span className="text-sm text-[#5C5849]">
                Average <span className="font-medium text-[#1A1A18]">{overallMastery}%</span>
              </span>
            )}
          </div>
          <MasteryBars bars={masteryBars} />
        </div>

        <div className="flex flex-col gap-3">
          {worksheetsError && <p className="text-sm text-[#C0392B]">Could not load your worksheets - please refresh.</p>}
          {!worksheetsError && (worksheets ?? []).length === 0 && (
            <EmptyState icon={FileText} message="No worksheets yet - ask your tutor or parent to generate one." />
          )}
          {(worksheets ?? []).map((worksheet) => {
            const submission = latestSubmissionByWorksheet.get(worksheet.id);
            return (
              <a
                key={worksheet.id}
                href={`${appUrl}/s/${worksheet.digital_code}`}
                className={`${interactiveCardClass} p-4 flex items-center justify-between gap-4`}
              >
                <div>
                  <p className="text-sm font-medium text-[#1A1A18]">
                    {worksheet.subject} - {worksheet.topic}
                  </p>
                  <p className="text-xs text-[#9A9080] mt-1">
                    {matchedStudents.length > 1 ? `${studentNameById.get(worksheet.student_id) ?? ''} - ` : ''}
                    {new Date(worksheet.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  {submission?.score_percentage != null ? (
                    <p className="text-sm font-medium text-[#1A3D2E]">{submission.score_percentage}%</p>
                  ) : (
                    <p className="text-xs text-[#9A9080] italic">Not submitted yet</p>
                  )}
                </div>
              </a>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
            {page > 1 && (
              <a href={`/student?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
                Previous
              </a>
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a href={`/student?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
                Next
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function PortalHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[#E0D9D0] bg-[#F7F4EF]/95 backdrop-blur-sm sticky top-0 z-10">
      <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
        Forma
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm text-[#5C5849] hover:bg-[#F0EBE3] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          Sign out
        </button>
      </form>
    </header>
  );
}
