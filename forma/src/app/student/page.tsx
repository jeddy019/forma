import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBranding } from '@/lib/branding';
import { resolvePortalSession } from '@/lib/portal/server';
import { portalSignOutAction } from './actions';
import { cardClass, interactiveCardClass, accentCardClass } from '@/lib/ui/formStyles';
import { EmptyState } from '@/lib/ui/EmptyState';
import MasteryBars from '@/lib/ui/MasteryBars';
import SrsSection, { type ReviewInfo } from '@/lib/ui/SrsSection';
import ScoresChart, { type ScorePoint } from '@/lib/ui/ScoresChart';
import StudyNow from '@/lib/ui/StudyNow';
import { toMasteryBars, masteryScore } from '@/lib/mastery/masteryView';
import { isDue, nextDueLabel } from '@/lib/srs/engine';
import { currentStreak } from '@/lib/streak/streak';
import type { SkillMap } from '@/lib/mastery/types';
import { BarChart3, FileText, Flame, LogOut, TrendingUp } from 'lucide-react';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface StudentRow {
  id: string;
  name: string;
  owner_id: string;
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

interface ReviewScheduleRow {
  student_id: string;
  sub_skill: string;
  sub_skill_label: string;
  next_review_at: string;
}

// Phase B Wave 1 (B8-B9): every submission across ALL of the student's
// worksheets (not just the paginated page) - the source of the daily streak
// and the recent-scores chart. No raw answers, no mark scheme - just scores
// and timestamps, safe for the student.
interface ActivitySubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
}

// W8 Wave B: the student portal's auth gate is now a portal_accounts session
// (username/password created at enrollment, no email) rather than a Supabase
// Auth email match - the portal account owns exactly one student, so the old
// merge-multiple-profiles-by-email path is gone by construction. Everything
// below the gate is unchanged: the same admin-client, safe-columns-only reads
// (Security Rules 1) as before.
export default async function StudentPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const session = await resolvePortalSession('student');
  if (!session) redirect('/student/login');

  const admin = createAdminClient();
  const { data: student } = await admin
    .from('student_profiles')
    .select('id, name, owner_id, skill_map')
    .eq('id', session.account.student_id as string)
    .single<StudentRow>();

  if (!student) redirect('/student/login');

  const studentIds = [student.id];

  // Same owner-brand resolution as /s/[code] and /q/[code]: the portal is a
  // student-facing surface, so the header carries the account's own brand
  // rather than "Forma".
  const { data: owners } = await admin
    .from('users')
    .select('brand_name, brand_accent')
    .eq('id', student.owner_id)
    .maybeSingle();
  const brand = resolveBranding(owners as { brand_name: string | null; brand_accent: string | null } | null);

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

  const masteryBars = toMasteryBars(student.skill_map);
  const overallMastery = masteryScore(masteryBars);

  // Phase B Wave 1 (B7): load the student's spaced-review schedule. Rows carry
  // no mark scheme and no raw answers - safe for the student.
  const { data: reviewSchedules } = await admin
    .from('review_schedule')
    .select('student_id, sub_skill, sub_skill_label, next_review_at')
    .eq('student_id', student.id)
    .order('next_review_at', { ascending: true })
    .returns<ReviewScheduleRow[]>();

  const reviewMap: Record<string, ReviewInfo> = {};
  const now = new Date();
  for (const row of reviewSchedules ?? []) {
    const entry = { nextReviewAt: row.next_review_at };
    reviewMap[row.sub_skill] = {
      tracked: true,
      due: isDue(entry, now),
      nextIn: nextDueLabel(entry, now),
    };
  }

  // Phase B Wave 1 (B8-B9): every submission across the student's worksheets
  // to compute the daily streak and the recent-scores chart - independent of
  // this page's pagination so the numbers are complete.
  const { data: activityWorksheets } = await admin
    .from('worksheets')
    .select('id')
    .eq('student_id', student.id)
    .range(0, 999)
    .returns<{ id: string }[]>();
  const allWorksheetIds = (activityWorksheets ?? []).map((w) => w.id);
  const { data: allSubmissions } = allWorksheetIds.length
    ? await admin
        .from('submissions')
        .select('worksheet_id, score_percentage, submitted_at')
        .in('worksheet_id', allWorksheetIds)
        .order('submitted_at', { ascending: false })
        .returns<ActivitySubmissionRow[]>()
    : { data: [] as ActivitySubmissionRow[] };

  const activitySubmissions = allSubmissions ?? [];
  const streak = currentStreak(
    activitySubmissions.map((s) => s.submitted_at),
    now
  );
  // Most recent ~10 scored submissions, oldest-first for the chart.
  const chartScores: ScorePoint[] = activitySubmissions
    .filter((s): s is ActivitySubmissionRow & { score_percentage: number } => s.score_percentage != null)
    .slice(0, 10)
    .reverse()
    .map((s) => ({
      dateLabel: new Date(s.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      score: s.score_percentage,
    }));

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <PortalHeader brandName={brand.name} />
      <main className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Hi {student.name.split(' ')[0]} - your practice</h1>
          <p className="text-sm text-[#5C5849]">Everything you&apos;ve completed, and what&apos;s next.</p>
        </div>

        <div className={`${accentCardClass} flex items-center justify-between gap-4`}>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-[#1A1A18]">Smart study</h2>
            <p className="text-sm text-[#5C5849]">
              We pick what to work on - a topic due for review, or your weakest skill - and start a short quiz.
            </p>
          </div>
          <StudyNow />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`${cardClass} flex items-center justify-between`}>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#9A9080]">Daily streak</p>
              <p className="text-2xl font-semibold text-[#1A1A18]">{streak} day{streak === 1 ? '' : 's'}</p>
              <p className="text-xs text-[#5C5849]">Keep it going - practise every day.</p>
            </div>
            <Flame className={`w-8 h-8 ${streak > 0 ? 'text-[#C8A84B]' : 'text-[#E0D9D0]'}`} strokeWidth={1.5} aria-hidden="true" />
          </div>

          <div className={`${cardClass} flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1A3D2E]" strokeWidth={2} aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#1A1A18]">Recent scores</h2>
            </div>
            <ScoresChart scores={chartScores} />
          </div>
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

        <SrsSection studentIds={studentIds} bars={masteryBars} reviewMap={reviewMap} />

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

function PortalHeader({ brandName = 'Forma' }: { brandName?: string }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[#E0D9D0] bg-[#F7F4EF]/95 backdrop-blur-sm sticky top-0 z-10">
      <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
        {brandName}
      </span>
      <form action={portalSignOutAction}>
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