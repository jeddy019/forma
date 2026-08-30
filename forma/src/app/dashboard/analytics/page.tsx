import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass, interactiveCardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { EmptyState } from '@/lib/ui/EmptyState';
import { PageHeader } from '@/lib/ui/PageHeader';
import { LineChart, TrendingUp, Timer, ClipboardCheck } from 'lucide-react';
import {
  computeCompletionStats,
  computeTimeStats,
  computeTopicStats,
  type AnalyticsWorksheetRow,
  type AnalyticsSubmissionRow,
} from '@/lib/analytics/stats';

// Performance Rule 3: never an unbounded list. The analytics overview is
// capped (Basic = up to 30 students / Pro = unlimited, but the row count is
// still a finite drill of the most recent worksheets).
const MAX_ROWS = 500;

interface WorksheetRow {
  id: string;
  first_opened_at: string | null;
  subject: string | null;
  topic: string | null;
  student: { id: string; name: string } | null;
}

interface SubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
  tutor_marks_json: unknown | null;
}

function statCard(icon: React.ReactNode, label: string, value: string, hint: string) {
  return (
    <div className={`${cardClass} p-4 flex flex-col gap-1`}>
      <div className="flex items-center gap-2 text-[#5C5849]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-3xl font-semibold text-[#1A1A18]" style={{ fontFamily: 'var(--font-fira)' }}>
        {value}
      </span>
      <span className="text-xs text-[#9A9080]">{hint}</span>
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Permissions Summary: analytics is a tutor-pro entitlement (Basic/Pro).
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  const gated = !ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at);

  const { data: worksheets } = gated
    ? { data: null }
    : await supabase
        .from('worksheets')
        .select('id, first_opened_at, subject, topic, student:student_profiles(id, name)')
        .order('created_at', { ascending: false })
        .range(0, MAX_ROWS - 1)
        .returns<WorksheetRow[]>();

  const { data: submissions } = gated
    ? { data: null }
    : worksheets?.length
      ? await supabase
          .from('submissions')
          .select('worksheet_id, score_percentage, submitted_at, tutor_marks_json')
          .in(
            'worksheet_id',
            worksheets.map((w) => w.id)
          )
          .order('submitted_at', { ascending: true })
          .returns<SubmissionRow[]>()
      : { data: [] };

  if (gated) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader icon={LineChart} title="Analytics" subtitle="Class-wide progress, completion, and performance at a glance." />
        <div className={`${cardClass} text-center`}>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Tutor analytics</h1>
          <p className="text-sm text-[#5C5849]">This view is available on the Tutor plan.</p>
        </div>
      </div>
    );
  }

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
  const topicStats = computeTopicStats(worksheetRows, submissionRows);

  // Per-student drill-down list, aggregated server-side for one pass.
  const byStudent = new Map<string, { id: string; name: string; total: number; submitted: number; scores: number[] }>();
  for (const w of worksheets ?? []) {
    if (!w.student) continue;
    const row = byStudent.get(w.student.id) ?? { id: w.student.id, name: w.student.name, total: 0, submitted: 0, scores: [] };
    row.total += 1;
    byStudent.set(w.student.id, row);
  }
  for (const s of submissions ?? []) {
    const worksheet = (worksheets ?? []).find((w) => w.id === s.worksheet_id);
    if (!worksheet?.student) continue;
    const row = byStudent.get(worksheet.student.id);
    if (!row) continue;
    row.submitted += 1;
    if (s.score_percentage != null) row.scores.push(s.score_percentage);
  }
  const studentRows = Array.from(byStudent.values())
    .map((s) => ({ ...s, averageScore: s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={LineChart}
        title="Analytics"
        subtitle="Class-wide progress, completion, and performance."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCard(
          <TrendingUp className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Completion rate',
          completion.completionRate == null ? '—' : `${completion.completionRate}%`,
          `${completion.submitted} of ${completion.total} worksheets submitted`
        )}
        {statCard(
          <ClipboardCheck className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Average score',
          completion.averageScore == null ? '—' : `${completion.averageScore}%`,
          `${completion.reviewed} reviewed by you`
        )}
        {statCard(
          <Timer className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Avg time to finish',
          time.averageMinutes == null ? '—' : `${time.averageMinutes} min`,
          time.sampleSize ? `from ${time.sampleSize} completed` : 'no completed worksheets yet'
        )}
        {statCard(
          <LineChart className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />,
          'Topics covered',
          `${topicStats.length}`,
          'distinct subject-topic pairs'
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-[#1A1A18]">By student</h2>
        {studentRows.length === 0 ? (
          <EmptyState
            icon={LineChart}
            message="No worksheet data yet - generate a worksheet for a student to start tracking progress."
            actionLabel="New worksheet"
            actionHref="/dashboard/generate"
          />
        ) : (
          studentRows.map((student) => (
            <Link
              key={student.id}
              href={`/dashboard/analytics/${student.id}`}
              className={`${interactiveCardClass} p-4 flex items-center justify-between gap-4`}
            >
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">{student.name}</p>
                <p className="text-xs text-[#9A9080]">
                  {student.submitted} of {student.total} worksheets submitted
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {student.averageScore != null && (
                  <span className="text-sm font-medium text-[#1A3D2E]">{student.averageScore}% avg</span>
                )}
                <span className="text-xs text-[#5C5849]">View</span>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-[#1A1A18]">By topic</h2>
        {topicStats.length === 0 ? (
          <p className="text-sm italic text-[#9A9080]">No worksheets yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {topicStats.map((topic) => (
              <div key={`${topic.subject}-${topic.topic}`} className={`${cardClass} p-3 flex items-center justify-between gap-4`}>
                <p className="text-sm text-[#1A1A18]">
                  <span className="text-[#5C5849]">{topic.subject ?? 'Unspecified'}</span> - {topic.topic ?? 'General'}
                </p>
                <div className="flex items-center gap-4 shrink-0 text-xs text-[#5C5849]">
                  <span>{topic.submitted}/{topic.total} submitted</span>
                  {topic.averageScore != null && <span className="text-[#1A3D2E] font-medium">{topic.averageScore}% avg</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
