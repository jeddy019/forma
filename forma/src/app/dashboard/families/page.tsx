import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmptyState } from '@/lib/ui/EmptyState';
import { PageHeader } from '@/lib/ui/PageHeader';
import { Home } from 'lucide-react';
import { currentInvoicePeriod, hasInvoiceForPeriod, invoicePeriodLabel } from '@/lib/invoices/familyBilling';
import FamilyForm from './FamilyForm';
import FamilyCard from './FamilyCard';
import FamilyInvoices, { type FamilyInvoiceRow } from './FamilyInvoices';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;
// W4: member-add selects list the owner's students not already in any
// family, capped to keep the dropdown sane on a busy account.
const STUDENT_LOOKUP_CAP = 50;

interface FamilyRow {
  id: string;
  name: string;
  parent_email: string | null;
}

interface MemberRow {
  family_id: string;
  student_id: string;
  student: { name: string } | null;
}

interface StudentRow {
  id: string;
  name: string;
}

// W4 family plan: the tutor-only Families page. One family row = one parent
// of the founder's, holding 1-3 children. The price shown on each card comes
// only from familyPricing.ts's tier table, never stored on the family row,
// so the quoted number can never drift from the offer.
export default async function FamiliesPage({
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
  if (!user) {
    redirect('/login');
  }

  const { data: ownerRow } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
  if (ownerRow?.role !== 'tutor') {
    redirect('/dashboard/students');
  }

  const {
    data: families,
    count,
    error,
  } = await supabase
    .from('families')
    // Performance Rule 2: never SELECT *.
    .select('id, name, parent_email', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<FamilyRow[]>();

  const familyIds = (families ?? []).map((family) => family.id);

  const { data: memberRows } = familyIds.length
    ? await supabase
        .from('family_members')
        .select('family_id, student_id, student:student_profiles(name)')
        .in('family_id', familyIds)
        .returns<MemberRow[]>()
    : { data: [] };

  const { data: students } = await supabase
    .from('student_profiles')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(STUDENT_LOOKUP_CAP)
    .returns<StudentRow[]>();

  // W5 - one fetch for every family on this page: the billing periods are
  // grouped per family below, and hasInvoiceForPeriod decides whether the
  // "Invoice for [month]" button is live or blocked.
  const { data: invoiceRows } = familyIds.length
    ? await supabase
        .from('family_invoices')
        .select('family_id, id, invoice_number, amount, currency, status, period_start, paid_at, payment_note')
        .in('family_id', familyIds)
        .order('period_start', { ascending: false })
        .returns<FamilyInvoiceRow[]>()
    : { data: [] };

  // Parent portal accounts: portal_accounts is deny-all RLS, so this read
  // uses the admin client (each family was already proven owned via the
  // families_own RLS query above). Only the username and last-reset date
  // ever leave the DB for display; the scrypt hash and plaintext never do.
  const { data: portalAccountRows } = familyIds.length
    ? await createAdminClient()
        .from('portal_accounts')
        .select('family_id, username, password_reset_at')
        .in('family_id', familyIds)
        .returns<{ family_id: string; username: string; password_reset_at: string | null }[]>()
    : { data: [] };
  const portalAccountByFamily = new Map<string, { username: string; password_reset_at: string | null }>();
  for (const row of portalAccountRows ?? []) {
    portalAccountByFamily.set(row.family_id, { username: row.username, password_reset_at: row.password_reset_at });
  }

  const assignedStudentIds = new Set((memberRows ?? []).map((row) => row.student_id));
  const unassignedStudents = (students ?? []).filter((student) => !assignedStudentIds.has(student.id));

  const membersByFamily = new Map<string, { studentId: string; name: string }[]>();
  for (const row of memberRows ?? []) {
    const list = membersByFamily.get(row.family_id) ?? [];
    list.push({ studentId: row.student_id, name: row.student?.name ?? 'Unknown student' });
    membersByFamily.set(row.family_id, list);
  }

  const invoicesByFamily = new Map<string, FamilyInvoiceRow[]>();
  for (const row of invoiceRows ?? []) {
    const list = invoicesByFamily.get(row.family_id) ?? [];
    list.push(row);
    invoicesByFamily.set(row.family_id, list);
  }

  const billingPeriod = currentInvoicePeriod(new Date());
  const billingPeriodLabel = invoicePeriodLabel(billingPeriod);

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={Home} title="Families" subtitle="Group each parent's children into one family for their inclusive monthly price." />

      <FamilyForm />

      <div className="flex flex-col gap-4">
        {error && <p className="text-sm text-[#C0392B]">Could not load families - please refresh.</p>}
        {!error && (families ?? []).length === 0 && (
          <EmptyState icon={Home} message="No families yet - create one above, then add its children." />
        )}
        {(families ?? []).map((family) => {
          const familyInvoices = invoicesByFamily.get(family.id) ?? [];
          return (
            <div key={family.id} className="flex flex-col gap-3">
              <FamilyCard
                familyId={family.id}
                name={family.name}
                parentEmail={family.parent_email}
                members={membersByFamily.get(family.id) ?? []}
                unassignedStudents={unassignedStudents}
                portalAccount={portalAccountByFamily.get(family.id) ?? null}
              />
              <FamilyInvoices
                familyId={family.id}
                childCount={(membersByFamily.get(family.id) ?? []).length}
                currentPeriodLabel={billingPeriodLabel}
                hasCurrentInvoice={hasInvoiceForPeriod(familyInvoices, billingPeriod)}
                invoices={familyInvoices}
              />
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
          {page > 1 && (
            <a href={`/dashboard/families?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
              Previous
            </a>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/dashboard/families?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}