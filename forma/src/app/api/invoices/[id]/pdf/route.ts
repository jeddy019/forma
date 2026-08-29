export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { renderInvoiceHtml } from '@/lib/pdf/invoice-template';
import { resolveBranding } from '@/lib/branding';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same budget as /api/pdf (Performance Rule 10) - this is a much simpler
// document than a worksheet, but there's no reason to grant it a longer
// timeout than the thing it's modelled on.
const PDF_TIMEOUT_MS = 25_000;

interface InvoiceRow {
  invoice_number: string;
  payment_reference: string;
  amount: number;
  currency: string;
  plan: 'tutor' | 'parent';
  created_at: string;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// No pdf_url to read - see add-invoices-table.sql's comment on why this
// project never stores PDFs. Regenerates from the invoices row every time,
// the same on-demand pattern /api/pdf already uses for worksheets
// (questions_json in, PDF buffer out, nothing persisted in between).
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

  // RLS (invoices_own_select, auth.uid() = user_id) is the real ownership
  // check - another user's invoice simply isn't returned, so "doesn't
  // exist" and "isn't yours" surface identically, same as /api/pdf's own
  // worksheet lookup.
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('invoice_number, payment_reference, amount, currency, plan, created_at')
    .eq('id', id)
    .single<InvoiceRow>();

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
  }

  const planName = invoice.plan === 'tutor' ? 'Forma Tutor' : 'Forma Parent';
  // W1 identity layer: the invoice wordmark/footer use the sign-in owner's
  // brand (RLS already scoped the invoice to them above).
  const { data: brandRow } = await supabase.from('users').select('brand_name, brand_accent').eq('id', user.id).single();
  const brand = resolveBranding(brandRow);
  const { html, footerTemplate } = renderInvoiceHtml({
    invoiceNumber: invoice.invoice_number,
    paidAt: new Date(invoice.created_at),
    customerName: user.email ?? '',
    customerEmail: user.email ?? '',
    planName,
    amountFormatted: formatAmount(invoice.amount, invoice.currency),
    paymentReference: invoice.payment_reference,
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
    console.error('Invoice PDF generation failed', error);
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
