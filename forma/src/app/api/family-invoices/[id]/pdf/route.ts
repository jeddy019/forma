export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { renderBillingInvoiceHtml } from '@/lib/pdf/invoice-template';
import { resolveBranding } from '@/lib/branding';
import { invoicePeriodLabel } from '@/lib/invoices/familyBilling';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PDF_TIMEOUT_MS = 25_000;

interface FamilyInvoiceRow {
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  period_start: string;
  paid_at: string | null;
  payment_note: string | null;
  family: {
    name: string;
    parent_email: string | null;
    family_members: { student: { name: string } | null }[] | null;
  } | null;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// W5: the branded statement PDF, regenerated on demand from the stored
// family_invoices row every time (nothing is ever stored - same pattern as
// /api/invoices/[id]/pdf). The authenticated client's RLS only returns a row
// whose FAMILY belongs to the caller (family_invoices_own), and the nested
// family/family_members reads are themselves RLS-scoped, so "not found"
// folds "doesn't exist" and "isn't yours" together. Founder-facing: this is
// the bill the founder downloads to send their parent - no student-facing
// surface references it.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('family_invoices')
    .select(
      'invoice_number, amount, currency, status, period_start, paid_at, payment_note, ' +
        'family:families(name, parent_email, family_members(student:student_profiles(name)))'
    )
    .eq('id', id)
    .single<FamilyInvoiceRow>();

  if (invoiceError || !invoice?.family) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const childrenNames = (invoice.family.family_members ?? []).map((m) => m.student?.name ?? '').filter(Boolean);

  const brandRow = await supabase.from('users').select('brand_name, brand_accent').eq('id', user.id).single();
  const brand = resolveBranding(brandRow.data ?? null);

  const { html, footerTemplate } = renderBillingInvoiceHtml({
    invoiceNumber: invoice.invoice_number,
    familyName: invoice.family.name,
    childrenNames,
    parentEmail: invoice.family.parent_email,
    periodLabel: invoicePeriodLabel({ start: new Date(invoice.period_start) }),
    amountFormatted: formatAmount(invoice.amount, invoice.currency),
    status: invoice.status,
    paidDateLabel: invoice.paid_at
      ? new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : null,
    paymentNote: invoice.payment_note,
    brand,
  });

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await Promise.race([
      generatePdf(html, 'A4', { footerTemplate }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('PDF_TIMEOUT')), PDF_TIMEOUT_MS)),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF_TIMEOUT') {
      return NextResponse.json({ error: 'This is taking longer than expected - please try again.' }, { status: 504 });
    }
    console.error('Family invoice PDF generation failed', error);
    return NextResponse.json({ error: 'Could not generate the invoice - please try again.' }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}