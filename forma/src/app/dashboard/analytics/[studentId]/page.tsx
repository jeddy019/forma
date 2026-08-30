import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass, interactiveCardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { PageHeader } from '@/lib/ui/PageHeader';
import { Timer, TrendingUp, ClipboardCheck, LineChart, ArrowLeft } from 'lucide-react';
import {
  computeCompletionStats,
  computeTimeStats,
  type AnalyticsWorksheetRow,
  type AnalyticsSubmissionRow,
} from '@/lib/analytics/stats';

interface WorksheetRow {
  id: string;
  digital_code: string;
  subject: string | null;
  topic: string | null;
  first_opened_at: string | null;
  created_at: string;
}

interface SubmissionRow {
  id: string;
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
  tutor_marks_json: unknown | null;
}

function statCard(icon: React.ReactNode, label: string, value: string) {
  return (
    <div className={`${cardClass} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-[#5C5849]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-3xl font-semibold text-[#1A1A18]" style={{ fontFamily: 'var(--font-fira)' }}>
        {value}
      </span>
    </div>
  );
}

export default async function StudentAnalyticsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Student analytics</h1>
        <p className="text-sm text-[#5C5849]">This view is available on the Tutor plan.</p>
      </div>
    );
  }

  // RLS (profiles_own) scopes to the tutor's own student.
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name')
    .eq('id', studentId)
    .single<{ id: string; name: string }>();
  if (!student) notFound();

  const { data: worksheets } = await supabase
    .from('worksheets')
    .select('id, digital_code, subject, topic, first_opened_at, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(100)
    .returns<WorksheetRow[]>();
  const worksheetIds = (worksheets ?? []).map((w) => w.id);

  const { data: submissions } =
    worksheetIds.length > 0
      ? await supabase
          .from('submissions')
          .select('id, worksheet_id, score_percentage, submitted_at, tutor_marks_json')
          .in('worksheet_id', worksheetIds)
          .order('submitted_at', { ascending: true })
          .returns<SubmissionRow[]>()
      : { data: [] };

  const worksheetRows: AnalyticsWorksheetRow[] = (worksheets ?? []).map((w) => ({
    id: w.id,
    first_opened_at: w.first_opened_at,
    subject: w.subject,
    topic: w.topic,
  }));
  const submissionRows: AnalyticsSubmissionRow[] = (submissions ?? []).map((s) => ({
    worksheet_id: s.worksheet_id,
    score_percentage: s.score_percentage,
    submitted_at: s.submitted_at,
    tutor_marks_json: s.tutor_marks_json,
  }));

  const completion = computeCompletionStats(worksheetRows, submissionRows);
  const time = computeTimeStats(worksheetRows, submissionRows);

  const byWorksheet = new Map((submissions ?? []).map((s) => [s.worksheet_id, s]));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return (
    <div className="flex flex-col gap-8">
      <Link href="/dashboard/analytics" className="flex items-center gap-1.5 text-sm text-[#1A3D2E] hover:underline">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        Back to analytics
      </Link>

      <PageHeader icon={LineChart} title={student.name} subtitle="This student&apos;s worksheet activity and performance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCard(
          <ClipboardCheck className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Worksheets set',
          `${completion.total}`
        )}
        {statCard(
          <TrendingUp className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Completion rate',
          completion.completionRate == null ? '—' : `${completion.completionRate}%`
        )}
        {statCard(
          <Timer className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Average score',
          completion.averageScore == null ? '—' : `${completion.averageScore}%`
        )}
        {statCard(
          <Timer className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Avg time to finish',
          time.averageMinutes == null ? '—' : `${time.averageMinutes} min`
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-[#1A1A18]">Worksheet history</h2>
        {(worksheets ?? []).length === 0 ? (
          <p className="text-sm italic text-[#9A9080]">No worksheets yet for this student.</p>
        ) : (
          (worksheets ?? []).map((worksheet) => {
            const submission = byWorksheet.get(worksheet.id) ?? null;
            return (
              <div key={worksheet.id} className={`${interactiveCardClass} p-4 flex items-center justify-between gap-4`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A18]">
                    {worksheet.subject ?? 'Subject'} - {worksheet.topic ?? 'General'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-[#9A9080]">{new Date(worksheet.created_at).toLocaleDateString('en-GB')}</span>
                    <a
                      href={`${appUrl}/s/${worksheet.digital_code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#1A3D2E] hover:underline"
                    >
                      Open link
                    </a>
                    {submission && (
                      <Link href={`/dashboard/marking/${submission.id}`} className="text-xs text-[#1A3D2E] hover:underline">
                        Review submission
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {submission?.score_percentage != null && (
                    <span className="text-sm font-medium text-[#1A3D2E]">{submission.score_percentage}%</span>
                  )}
                  <span
                    className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                      submission ? (submission.tutor_marks_json !== null ? 'bg-[#1A3D2E] text-white' : 'bg-[#E8F2ED] text-[#1A3D2E]') : 'bg-[#F0EBE3] text-[#5C5849]'
                    }`}
                  >
                    {submission ? (submission.tutor_marks_json !== null ? 'Reviewed' : 'Submitted') : 'Assigned'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
