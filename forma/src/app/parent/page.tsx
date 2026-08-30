import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBranding } from '@/lib/branding';
import { resolvePortalSession } from '@/lib/portal/server';
import { parentSignOutAction } from './actions';
import { cardClass } from '@/lib/ui/formStyles';
import { EmptyState } from '@/lib/ui/EmptyState';
import MasteryBars from '@/lib/ui/MasteryBars';
import ScoresChart, { type ScorePoint } from '@/lib/ui/ScoresChart';
import { toMasteryBars, masteryScore, type MasteryBar } from '@/lib/mastery/masteryView';
import type { SkillMap } from '@/lib/mastery/types';
import { invoicePeriodLabel } from '@/lib/invoices/familyBilling';
import { Home, LogOut, Receipt, FileText } from 'lucide-react';

// W8 Wave B slice 2 (parent portal): the VIEW-ONLY proof portal for one
// family - a parent opens it (kind 'parent' portal account, provisioned by
// the founder at family creation) and sees exactly what the weekly report
// already promised: each child's progress, history, mastery, and the family's
// monthly statements. Deliberately nothing else: no difficulty dials, no game
// settings, no mark schemes, no self-serve configuration (the anti-swallow
// invariant - a parent asking for "more" gets the founder flipping the dial,
// never a control of their own). Every read below is admin-client + filtered
// by the family_id the session already owns, and only student-safe columns
// are ever selected (Security Rules 1).

// Performance Rule 3: never load an unbounded list. Weekly-report-relevant
// window is small; keep the per-child display history capped.
const RECENT_WORKSHEETS_PER_CHILD = 5;
const WORKSHEETS_FETCH_LIMIT = 20;
const CHART_SCORED_LIMIT = 10;

type Country = 'england' | 'canada_ontario' | 'united_states';

function localeForCountry(country: Country | null): string {
  if (country === 'united_states') return 'en-US';
  if (country === 'canada_ontario') return 'en-CA';
  return 'en-GB';
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

interface FamilyRow {
  id: string;
  name: string;
  parent_email: string | null;
  owner_id: string;
}

interface StudentProfileRow {
  id: string;
  name: string;
  country: Country | null;
  curriculum_level: string | null;
  year_level: string | null;
  skill_map: SkillMap | null;
  report_note: string | null;
  last_report_sent_at: string | null;
}

interface WorksheetRow {
  id: string;
  subject: string | null;
  topic: string | null;
  created_at: string;
}

interface SubmissionRow {
  worksheet_id: string;
  score_percentage: number | null;
  submitted_at: string;
}

interface InvoiceRow {
  period_start: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  paid_at: string | null;
}

interface ChildView {
  id: string;
  name: string;
  locale: string;
  curriculum_level: string | null;
  year_level: string | null;
  average: number | null;
  chartScores: ScorePoint[];
  masteryBars: MasteryBar[];
  worksheets: (WorksheetRow & { score: number | null })[];
  last_report_sent_at: string | null;
  report_note: string | null;
}

function amountLabel(amount: number, currency: string): string {
  return `${currency === 'GBP' ? '£' : `${currency} `}${Number(amount).toLocaleString('en-GB')}`;
}

export default async function ParentPortalPage() {
  const session = await resolvePortalSession('parent');
  if (!session) redirect('/parent/login');

  const admin = createAdminClient();
  const familyId = session.account.family_id;
  if (!familyId) redirect('/parent/login');

  const { data: family } = await admin
    .from('families')
    .select('id, name, parent_email, owner_id')
    .eq('id', familyId)
    .single<FamilyRow>();

  if (!family) redirect('/parent/login');

  // The portal is a parent-facing surface, so it carries the account's own
  // brand (the founder's name), exactly like /s/[code] and /q/[code].
  const { data: ownerRow } = await admin
    .from('users')
    .select('brand_name, brand_accent')
    .eq('id', family.owner_id)
    .maybeSingle();
  const brand = resolveBranding(ownerRow as { brand_name: string | null; brand_accent: string | null } | null);

  const { data: memberRows } = await admin
    .from('family_members')
    .select('student_id')
    .eq('family_id', familyId)
    .returns<{ student_id: string }[]>();
  const studentIds = (memberRows ?? []).map((row) => row.student_id);

  const { data: studentRows } = studentIds.length
    ? await admin
        .from('student_profiles')
        .select('id, name, country, curriculum_level, year_level, skill_map, report_note, last_report_sent_at')
        .in('id', studentIds)
        .order('name', { ascending: true })
        .returns<StudentProfileRow[]>()
    : { data: [] as StudentProfileRow[] };

  const { data: invoiceRows } = await admin
    .from('family_invoices')
    .select('period_start, amount, currency, status, paid_at')
    .eq('family_id', familyId)
    .order('period_start', { ascending: false })
    .returns<InvoiceRow[]>();

  const children: ChildView[] = [];
  for (const student of studentRows ?? []) {
    const { data: worksheets } = await admin
      .from('worksheets')
      .select('id, subject, topic, created_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .range(0, WORKSHEETS_FETCH_LIMIT - 1)
      .returns<WorksheetRow[]>();

    const worksheetIds = (worksheets ?? []).map((w) => w.id);
    const { data: submissions } = worksheetIds.length
      ? await admin
          .from('submissions')
          .select('worksheet_id, score_percentage, submitted_at')
          .in('worksheet_id', worksheetIds)
          .returns<SubmissionRow[]>()
      : { data: [] as SubmissionRow[] };

    const latestScoreByWorksheet = new Map<string, SubmissionRow>();
    for (const submission of submissions ?? []) {
      const existing = latestScoreByWorksheet.get(submission.worksheet_id);
      if (!existing || submission.submitted_at > existing.submitted_at) {
        latestScoreByWorksheet.set(submission.worksheet_id, submission);
      }
    }

    const scored = (submissions ?? []).filter(
      (s): s is SubmissionRow & { score_percentage: number } => s.score_percentage != null
    );
    const chartScores: ScorePoint[] = scored.slice(0, CHART_SCORED_LIMIT).reverse().map((s) => ({
      dateLabel: new Date(s.submitted_at).toLocaleDateString(localeForCountry(student.country), {
        day: 'numeric',
        month: 'short',
      }),
      score: s.score_percentage,
    }));

    const masteryBars = toMasteryBars(student.skill_map);
    const average = masteryScore(masteryBars);

    children.push({
      ...student,
      locale: localeForCountry(student.country),
      worksheets: (worksheets ?? []).slice(0, RECENT_WORKSHEETS_PER_CHILD).map((w) => ({
        ...w,
        score: latestScoreByWorksheet.get(w.id)?.score_percentage ?? null,
      })),
      chartScores,
      masteryBars,
      average,
    });
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#E0D9D0] bg-[#F7F4EF]/95 backdrop-blur-sm sticky top-0 z-10">
        <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
          {brand.name}
        </span>
        <form action={parentSignOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-sm text-[#5C5849] hover:bg-[#F0EBE3] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </header>

      <main className="px-6 py-8 max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-[#1A3D2E]" strokeWidth={1.75} aria-hidden="true" />
            <h1 className="text-xl font-semibold text-[#1A1A18]">Your family&apos;s practice</h1>
          </div>
          <p className="text-sm text-[#5C5849] mt-1">
            A weekly look at how {family.name} is doing - from {brand.name}.
          </p>
        </div>

        {children.length === 0 && (
          <EmptyState icon={FileText} message="No children set up yet - your tutor will add them." />
        )}

        {children.map((child) => (
          <div key={child.id} className={`${cardClass} flex flex-col gap-5`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#1A1A18]">{child.name}</h2>
                <p className="text-xs text-[#5C5849] mt-0.5">
                  {child.curriculum_level ?? ''}
                  {child.year_level ? ` - ${child.year_level}` : ''}
                </p>
              </div>
              {child.average != null && (
                <p className="text-sm text-[#5C5849]">
                  Average <span className="font-medium text-[#1A1A18]">{child.average}%</span>
                </p>
              )}
            </div>

            {child.chartScores.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-[0.06em] text-[#9A9080]">Recent scores</p>
                <ScoresChart scores={child.chartScores} />
              </div>
            )}

            {child.masteryBars.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-[0.06em] text-[#9A9080]">What they know</p>
                <MasteryBars bars={child.masteryBars} />
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#9A9080]">Recent work</p>
              {child.worksheets.length === 0 && (
                <p className="text-sm text-[#9A9080] italic">Practice is being set up - it starts soon.</p>
              )}
              {child.worksheets.map((worksheet) => (
                <div key={worksheet.id} className="flex items-center justify-between gap-4 py-1">
                  <p className="text-sm text-[#1A1A18]">
                    {worksheet.subject ?? 'Practice'} - {worksheet.topic ?? 'Worksheet'}
                    <span className="text-xs text-[#9A9080] ml-2">
                      {formatDate(worksheet.created_at, child.locale)}
                    </span>
                  </p>
                  {worksheet.score != null ? (
                    <p className="text-sm font-medium text-[#1A3D2E]">{worksheet.score}%</p>
                  ) : (
                    <p className="text-xs text-[#9A9080] italic">Due</p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-[#E0D9D0] pt-3 flex flex-col gap-0.5">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#9A9080]">Weekly report</p>
              {child.last_report_sent_at ? (
                <>
                  <p className="text-sm text-[#5C5849]">
                    Latest report sent {formatDate(child.last_report_sent_at, child.locale)}.
                  </p>
                  {child.report_note && <p className="text-sm text-[#1A1A18] italic mt-1">{child.report_note}</p>}
                </>
              ) : (
                <p className="text-sm text-[#9A9080] italic">Your weekly report arrives by email once practice gets going.</p>
              )}
            </div>
          </div>
        ))}

        <div className={`${cardClass} flex flex-col gap-3`}>
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#1A3D2E]" strokeWidth={1.75} aria-hidden="true" />
            <h2 className="text-base font-semibold text-[#1A1A18]">Statements</h2>
          </div>
          <p className="text-sm text-[#5C5849]">
            You pay your tutor directly - these statements are for your records.
          </p>
          {(invoiceRows ?? []).length === 0 && (
            <EmptyState icon={Receipt} message="No statements yet - your first monthly statement appears here." />
          )}
          {(invoiceRows ?? []).map((invoice) => (
            <div key={invoice.period_start} className="flex items-center justify-between gap-4 py-1">
              <p className="text-sm text-[#1A1A18]">
                {invoicePeriodLabel({ start: new Date(invoice.period_start) })}
                <span className="text-xs text-[#9A9080] ml-2">{amountLabel(invoice.amount, invoice.currency)}</span>
              </p>
              {invoice.status === 'paid' ? (
                <span className="text-xs bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2.5 py-1">
                  Paid{invoice.paid_at ? ` ${new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                </span>
              ) : (
                <span className="text-xs bg-[#FEF9EC] text-[#B8963C] border border-[#C8A84B] rounded-full px-2.5 py-1">
                  Payment due
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[#9A9080] text-center">Questions about your child&apos;s learning? Ask your tutor directly.</p>
      </main>
    </div>
  );
}