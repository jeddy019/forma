import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { resolveStudentFamilyEmails } from '@/lib/families/parentEmail';
import { PageHeader } from '@/lib/ui/PageHeader';
import { EmptyState } from '@/lib/ui/EmptyState';
import { accentCardClass, cardClass, secondaryButtonClass } from '@/lib/ui/formStyles';
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FilePlus,
  Home,
  Receipt,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';

// Founder model (W8, "Needs you today"): the /dashboard home. One server
// pass, RLS-scoped to the logged-in account, that answers the daily
// question - what actually needs the founder's hands right now - instead of
// dumping the raw students list at the visitor. Everything shown is data we
// already store; nothing here is invented or estimated.
const PRACTICE_LOOKBACK_DAYS = 7;
const ROW_LIMIT = 200;

interface StudentRow {
  id: string;
  name: string;
  last_report_sent_at: string | null;
}

interface WorksheetRow {
  id: string;
  student_id: string | null;
  topic: string | null;
  created_at: string;
}

interface SubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
}

interface InvoiceRow {
  status: string;
  amount: number | null;
}

// Midnight at the founder's operating timezone (Europe/London, until the
// founder model grows a timezone preference), as a UTC ISO string - the same
// en-CA date-slice trick familyBilling.ts uses, so generator and cockpit
// agree on which calendar day "today" is.
function startOfDayIso(now: Date, timeZone = 'Europe/London'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${parts}T00:00:00`).toISOString();
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function amountLabel(amount: number): string {
  return `£${amount.toLocaleString('en-GB')}`;
}

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  const isTutor = ownerRow?.role === 'tutor';

  const now = new Date();
  const todayIso = startOfDayIso(now);
  const weekIso = new Date(now.getTime() - PRACTICE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: students } = await supabase
    .from('student_profiles')
    .select('id, name, last_report_sent_at')
    .order('created_at', { ascending: false })
    .limit(ROW_LIMIT)
    .returns<StudentRow[]>();

  // W8 Wave E (family-first): a parent email lives on the FAMILY - resolve
  // every loaded student's family email in one query so the report count and
  // the heads-up copy key off real family emails, not a retired column.
  const { emails: familyEmails } = await resolveStudentFamilyEmails(supabase, (students ?? []).map((s) => s.id));
  const hasFamilyEmail = new Set([...familyEmails.keys()]);
  const noStudents = (students ?? []).length === 0;

  const [{ data: todayRows }, { data: weekRows }] = await Promise.all([
    supabase.from('worksheets').select('id, student_id').gte('created_at', todayIso).limit(ROW_LIMIT),
    supabase
      .from('worksheets')
      .select('id, student_id, topic, created_at')
      .gte('created_at', weekIso)
      .limit(ROW_LIMIT)
      .returns<WorksheetRow[]>(),
  ]);

  const practicedToday = new Set((todayRows ?? []).map((row) => row.student_id).filter(Boolean));
  const studentsNeedingPractice = (students ?? []).filter((student) => !practicedToday.has(student.id));

  const weekWorksheetIds = (weekRows ?? []).map((row) => row.id);
  const { data: submissionRows } = weekWorksheetIds.length
    ? await supabase
        .from('submissions')
        .select('worksheet_id, score_percentage')
        .in('worksheet_id', weekWorksheetIds)
        .returns<SubmissionRow[]>()
    : { data: [] };

  const submittedWorksheetIds = new Set((submissionRows ?? []).map((submission) => submission.worksheet_id));
  const unsubmitted = (weekRows ?? []).filter((worksheet) => !submittedWorksheetIds.has(worksheet.id));

  const studentNameById = new Map((students ?? []).map((student) => [student.id, student.name]));
  const scored = (submissionRows ?? []).filter((submission) => submission.score_percentage !== null);
  const weekAverage =
    scored.length > 0 ? Math.round(scored.reduce((sum, s) => sum + (s.score_percentage ?? 0), 0) / scored.length) : null;

  const reportsDue = (students ?? []).filter(
    (student) => hasFamilyEmail.has(student.id) && (!student.last_report_sent_at || student.last_report_sent_at < weekIso)
  );

  const { data: invoiceRows } = isTutor
    ? await supabase
        .from('family_invoices')
        .select('status, amount')
        .eq('status', 'pending')
        .returns<InvoiceRow[]>()
    : { data: [] as InvoiceRow[] };
  const pendingInvoices = invoiceRows ?? [];
  const pendingInvoiceTotal = pendingInvoices.reduce((sum, invoice) => sum + (invoice.amount ?? 0), 0);

  const needs = {
    practice: studentsNeedingPractice,
    unsubmittedCount: unsubmitted.length,
    reportsDue,
    pendingInvoices: pendingInvoices.length,
    pendingInvoiceTotal,
  };
  const hasAnyNeed =
    needs.practice.length > 0 || needs.unsubmittedCount > 0 || needs.reportsDue.length > 0 || needs.pendingInvoices > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={Sparkles}
        title="Needs you today"
        subtitle="The daily checklist for running your practice - nothing here is estimated."
      />

      {noStudents ? (
        <EmptyState
          icon={UserPlus}
          message="No students yet - add your first one, then the daily checklist starts here."
          actionLabel="Add a student"
          actionHref="/dashboard/students"
        />
      ) : (
        <>
          <section className={`${accentCardClass} flex flex-col gap-4`}>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-medium uppercase tracking-[0.08em] text-[#C8A84B]">To do</span>
            </div>

            {!hasAnyNeed && (
              <div className="flex items-center gap-2 text-sm text-[#1A3D2E]">
                <ClipboardCheck className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                All caught up - every student has practice today, this week&apos;s work is submitted, and nothing is waiting.
              </div>
            )}

            {needs.practice.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-[#1A1A18] font-medium">
                  {needs.practice.length === 1 ? '1 student has no practice generated yet today' : `${needs.practice.length} students have no practice generated yet today`}
                </p>
                <p className="text-sm text-[#5C5849]">
                  {needs.practice.map((student) => (
                    <Link key={student.id} href={`/dashboard/students/${student.id}`} className="underline underline-offset-2 decoration-[#C4B9AC] hover:text-[#1A3D2E]">
                      {student.name}
                    </Link>
                  )).reduce<ReactNode[]>((nodes, node, index) => {
                    if (index === 0) return [node];
                    return [...nodes, <span key={`sep-${index}`}>, </span>, node];
                  }, [])}
                </p>
              </div>
            )}

            {needs.unsubmittedCount > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-[#1A1A18] font-medium">
                  {needs.unsubmittedCount} worksheet{needs.unsubmittedCount === 1 ? '' : 's'} from the last {PRACTICE_LOOKBACK_DAYS} days not yet submitted
                </p>
                <p className="text-sm text-[#5C5849]">
                  {unsubmitted.slice(0, 6).map((worksheet) => (
                    <span key={worksheet.id} className="inline-flex items-center gap-1.5 mr-4">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C8A84B]" />
                      {studentNameById.get(worksheet.student_id ?? '') ?? 'Unknown student'}
                      {worksheet.topic ? ` - ${worksheet.topic}` : ''}
                      <span className="text-xs text-[#9A9080]">{shortDate(worksheet.created_at)}</span>
                    </span>
                  ))}
                  {needs.unsubmittedCount > 6 && <span className="text-xs text-[#9A9080]">and {needs.unsubmittedCount - 6} more</span>}
                </p>
              </div>
            )}

            {needs.reportsDue.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-[#1A1A18] font-medium">
                  Weekly report still to send this week ({needs.reportsDue.length} of {hasFamilyEmail.size} in a family with an email)
                </p>
                <p className="text-sm text-[#5C5849]">
                  {needs.reportsDue.map((student) => (
                    <Link key={student.id} href={`/dashboard/students/${student.id}`} className="underline underline-offset-2 decoration-[#C4B9AC] hover:text-[#1A3D2E]">
                      {student.name}
                    </Link>
                  )).reduce<ReactNode[]>((nodes, node, index) => {
                    if (index === 0) return [node];
                    return [...nodes, <span key={`sep-${index}`}>, </span>, node];
                  }, [])}
                </p>
              </div>
            )}

            {needs.pendingInvoices > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-[#1A1A18] font-medium">
                  {needs.pendingInvoices === 1 ? '1 family invoice' : `${needs.pendingInvoices} family invoices`} due for payment
                  {needs.pendingInvoiceTotal > 0 && <span className="text-[#B8963C]"> - {amountLabel(needs.pendingInvoiceTotal)} outstanding</span>}
                </p>
              </div>
            )}

            <div className="pt-1">
              <Link href={hasAnyNeed ? '/dashboard/generate' : '/dashboard/students'} className={secondaryButtonClass}>
                {needs.practice.length > 0 ? 'Generate practice' : 'Open students'}
                <ArrowRight className="w-4 h-4 ml-1.5" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </div>
          </section>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Issued this week', value: String((weekRows ?? []).length), icon: FilePlus },
              { label: 'Submitted', value: String(submittedWorksheetIds.size), icon: ClipboardCheck },
              { label: 'Average score', value: weekAverage === null ? 'No data' : `${weekAverage}%`, icon: Sparkles },
              { label: 'Unsubmitted', value: String(needs.unsubmittedCount), icon: CalendarClock },
            ].map((stat) => (
              <div key={stat.label} className={`${cardClass} flex items-center gap-3 p-4`}>
                <stat.icon className="w-4 h-4 text-[#5C5849] shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <div>
                  <p className="text-lg font-semibold text-[#1A1A18] leading-tight">{stat.value}</p>
                  <p className="text-xs text-[#9A9080]">{stat.label}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-[#9A9080]">Quick actions</h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/generate" className={secondaryButtonClass}>
                <FilePlus className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> New practice
              </Link>
              <Link href="/dashboard/students" className={secondaryButtonClass}>
                <Users className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> Students
              </Link>
              {isTutor && (
                <Link href="/dashboard/families" className={secondaryButtonClass}>
                  <Home className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> Families
                </Link>
              )}
              {isTutor && (
                <Link href="/dashboard/marking" className={secondaryButtonClass}>
                  <Receipt className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> Marking
                </Link>
              )}
              {isTutor && (
                <Link href="/dashboard/schedule" className={secondaryButtonClass}>
                  <CalendarClock className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> Schedule
                </Link>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}