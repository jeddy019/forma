import type { createAdminClient } from '@/lib/supabase/admin';
import { generatePdf } from '@/lib/pdf/browser-pool';
import { renderInvoiceHtml } from '@/lib/pdf/invoice-template';
import type { SubscribableRole } from '@/lib/payments/plans';
import { resolveBranding } from '@/lib/branding';

type AdminClient = ReturnType<typeof createAdminClient>;

export interface CreateInvoiceParams {
  userId: string;
  customerEmail: string;
  paymentReference: string;
  amount: number;
  currency: string;
  planKey: SubscribableRole;
}

export interface CreateInvoiceResult {
  invoiceNumber: string;
  pdfBuffer: Buffer;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    // Intl throws on an unrecognised currency code rather than falling back
    // gracefully - defends against a provider one day sending something
    // Intl doesn't recognise as ISO 4217, which would otherwise take down
    // invoice generation (and therefore EMAIL 6) entirely.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Called only from activateSubscriptionFromTransaction, after a Flutterwave
// charge has already been independently verified server-side - never
// invoked from anything a client could trigger directly. Inserts the
// invoices row first (that row is the permanent record) and renders the PDF
// second - the PDF itself is never stored (see add-invoices-table.sql's own
// comment on pdf_url), it exists only for this one email send and for
// on-demand regeneration later via /api/invoices/[id]/pdf.
export async function createInvoice(admin: AdminClient, params: CreateInvoiceParams): Promise<CreateInvoiceResult | null> {
  const { data: numberResult, error: numberError } = await admin.rpc('generate_invoice_number');
  if (numberError || !numberResult) {
    console.error('Failed to generate invoice number', numberError);
    return null;
  }
  const invoiceNumber = numberResult as string;

  const { error: insertError } = await admin.from('invoices').insert({
    user_id: params.userId,
    invoice_number: invoiceNumber,
    payment_reference: params.paymentReference,
    amount: params.amount,
    currency: params.currency,
    plan: params.planKey,
  });
  if (insertError) {
    console.error('Failed to insert invoice row', insertError);
    return null;
  }

  const planName = params.planKey === 'tutor' ? 'Forma Tutor' : 'Forma Parent';
  // W1 identity layer: the invoice wordmark/footer carry the account owner's
  // brand. The admin client bypasses RLS but rows are only ever read by
  // their own id (the verified subscriber) - brand_name/accent are the
  // owner's own cosmetic settings, not another user's data.
  const { data: brandRow } = await admin.from('users').select('brand_name, brand_accent').eq('id', params.userId).single();
  const brand = resolveBranding(brandRow);
  const { html, footerTemplate } = renderInvoiceHtml({
    invoiceNumber,
    paidAt: new Date(),
    customerName: params.customerEmail,
    customerEmail: params.customerEmail,
    planName,
    amountFormatted: formatAmount(params.amount, params.currency),
    paymentReference: params.paymentReference,
    brand,
  });

  const pdfBuffer = await generatePdf(html, 'A4', { footerTemplate });
  return { invoiceNumber, pdfBuffer };
}
