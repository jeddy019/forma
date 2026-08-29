import { buildFooterTemplate, escapeHtml, formatDate } from './worksheet-template';
import { printFontFaces } from '@/lib/render/printStyles';
import { BRANDING_DEFAULTS } from '../branding';
import type { Branding } from '../branding';

// Fonts are embedded via printFontFaces() (base64 data URIs, built once per
// process) - invoices previously fetched Google Fonts at print time over the
// network inside headless Chromium, the same stall risk that took down
// worksheet downloads. No maths notation here, so no KaTeX styles.

export interface InvoiceTemplateData {
  invoiceNumber: string;
  paidAt: Date;
  customerName: string;
  customerEmail: string;
  planName: string;
  amountFormatted: string;
  paymentReference: string;
  /** W1 identity layer - wordmark brand. Defaults to platform defaults. */
  brand?: Branding;
}

// Deliberately much smaller than PAGE_STYLES in worksheet-template.ts - an
// invoice has no diagrams, no working lines, no section dividers, none of
// the worksheet-specific print machinery, just a header/rule (matching the
// PDF header language every other Forma document already uses) and a
// simple row-per-field layout.
const INVOICE_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #F7F4EF; color: #1A1A18; font-family: 'Inter', sans-serif; font-weight: 400; padding: 40px; }
.header-row-1 { display: flex; align-items: baseline; justify-content: space-between; }
.wordmark { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #1A3D2E; }
.invoice-label { font-family: 'Inter', sans-serif; font-size: 13px; color: #9A9080; }
.header-rule { border: none; border-top: 2px solid #1A3D2E; margin: 8px 0 28px; }
.field-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 0.5px solid #E0D9D0; }
.field-label { font-size: 13px; color: #5C5849; }
.field-value { font-size: 13px; color: #1A1A18; font-weight: 500; }
.amount-row .field-value { font-size: 17px; font-weight: 600; color: #1A3D2E; }
.thank-you { margin-top: 40px; font-size: 13px; color: #1A1A18; }
`;

// W5 founder-model billing invoice: the branded STATEMENT a parent receives
// for their family's inclusive monthly tier. Rendered from a stored
// family_invoices row and sent/re-sent by the founder - nothing student-
// facing reads it, and it is NEVER a paywall (the child opening /s/[code] or
// /q/[code] never learns this document exists).
const BILLING_INVOICE_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #F7F4EF; color: #1A1A18; font-family: 'Inter', sans-serif; font-weight: 400; padding: 40px; }
.header-row-1 { display: flex; align-items: baseline; justify-content: space-between; }
.wordmark { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #1A3D2E; }
.invoice-label { font-family: 'Inter', sans-serif; font-size: 13px; color: #5C5849; }
.header-rule { border: none; border-top: 2px solid #1A3D2E; margin: 8px 0 28px; }
.statement-title { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 600; color: #1A1A18; margin-bottom: 2px; }
.statement-sub { font-size: 13px; color: #5C5849; margin-bottom: 24px; }
.field-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 0.5px solid #E0D9D0; }
.field-label { font-size: 13px; color: #5C5849; }
.field-value { font-size: 13px; color: #1A1A18; font-weight: 500; text-align: right; }
.amount-row .field-value { font-size: 17px; font-weight: 600; color: #1A3D2E; }
.status-row .field-value { font-size: 13px; font-weight: 600; }
.status-paid .field-value { color: #1A3D2E; }
.status-due .field-value { color: #B8963C; }
.payment-note { margin-top: 16px; font-size: 12px; color: #5C5849; }
.thank-you { margin-top: 40px; font-size: 13px; color: #1A1A18; }
`;

export interface BillingInvoiceTemplateData {
  invoiceNumber: string;
  familyName: string;
  childrenNames: string[];
  parentEmail: string | null;
  periodLabel: string;
  amountFormatted: string;
  status: 'pending' | 'paid';
  paidDateLabel: string | null;
  paymentNote: string | null;
  /** W1 identity layer - wordmark brand. Defaults to platform defaults. */
  brand?: Branding;
}

export function renderBillingInvoiceHtml(data: BillingInvoiceTemplateData): { html: string; footerTemplate: string } {
  const brand = data.brand ?? BRANDING_DEFAULTS;
  const children = data.childrenNames.length > 0 ? data.childrenNames.join(', ') : '—';
  const statusRow =
    data.status === 'paid'
      ? `<div class="field-row status-row status-paid">
           <span class="field-label">Payment status</span>
           <span class="field-value">Paid${data.paidDateLabel ? ` on ${escapeHtml(data.paidDateLabel)}` : ''}</span>
         </div>`
      : `<div class="field-row status-row status-due">
           <span class="field-label">Payment status</span>
           <span class="field-value">Payment due</span>
         </div>`;
  const paymentNote = data.paymentNote ? `<p class="payment-note">Payment: ${escapeHtml(data.paymentNote)}</p>` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${printFontFaces()}</style>
<style>${BILLING_INVOICE_STYLES}</style>
</head>
<body>
  <div class="header-row-1">
    <span class="wordmark">${escapeHtml(brand.name)}</span>
    <span class="invoice-label">Invoice ${escapeHtml(data.invoiceNumber)}</span>
  </div>
  <hr class="header-rule">

  <div class="statement-title">Statement for ${escapeHtml(data.familyName)}</div>
  <div class="statement-sub">Month billed: ${escapeHtml(data.periodLabel)}</div>

  <div class="field-row">
    <span class="field-label">For</span>
    <span class="field-value">${escapeHtml(children)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Sessions</span>
    <span class="field-value">3 x 1-hour live sessions (each week)</span>
  </div>
  <div class="field-row">
    <span class="field-label">Daily practice</span>
    <span class="field-value">Auto-generated practice between sessions</span>
  </div>
  <div class="field-row">
    <span class="field-label">Proof report</span>
    <span class="field-value">Weekly report to the parent</span>
  </div>
  <div class="field-row">
    <span class="field-label">Billed to</span>
    <span class="field-value">${data.parentEmail ? escapeHtml(data.parentEmail) : '—'}</span>
  </div>
  <div class="field-row amount-row">
    <span class="field-label">Total for ${escapeHtml(data.periodLabel)}</span>
    <span class="field-value">${escapeHtml(data.amountFormatted)}</span>
  </div>
  ${statusRow}

  ${paymentNote}
  <p class="thank-you">Thank you for choosing ${escapeHtml(brand.name)}.</p>
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate(brand.name) };
}

export function renderInvoiceHtml(data: InvoiceTemplateData): { html: string; footerTemplate: string } {
  const brand = data.brand ?? BRANDING_DEFAULTS;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${printFontFaces()}</style>
<style>${INVOICE_STYLES}</style>
</head>
<body>
  <div class="header-row-1">
    <span class="wordmark">${escapeHtml(brand.name)}</span>
    <span class="invoice-label">Invoice ${escapeHtml(data.invoiceNumber)}</span>
  </div>
  <hr class="header-rule">

  <div class="field-row">
    <span class="field-label">Date of payment</span>
    <span class="field-value">${formatDate(data.paidAt)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Customer</span>
    <span class="field-value">${escapeHtml(data.customerName)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Email</span>
    <span class="field-value">${escapeHtml(data.customerEmail)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Plan</span>
    <span class="field-value">${escapeHtml(data.planName)}</span>
  </div>
  <div class="field-row amount-row">
    <span class="field-label">Amount paid</span>
    <span class="field-value">${escapeHtml(data.amountFormatted)}</span>
  </div>
  <div class="field-row">
    <span class="field-label">Payment reference</span>
    <span class="field-value">${escapeHtml(data.paymentReference)}</span>
  </div>

  <p class="thank-you">Thank you for choosing ${escapeHtml(brand.name)}.</p>
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate(brand.name) };
}
