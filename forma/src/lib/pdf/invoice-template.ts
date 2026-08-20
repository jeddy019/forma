import { FONT_LINKS, buildFooterTemplate, escapeHtml, formatDate } from './worksheet-template';

// No MathJax here - invoices have no maths notation, so this skips
// worksheet-template.ts's MATHJAX_SCRIPTS entirely (nothing to typeset,
// no reason to pay for the CDN fetch on every invoice render).

export interface InvoiceTemplateData {
  invoiceNumber: string;
  paidAt: Date;
  customerName: string;
  customerEmail: string;
  planName: string;
  amountFormatted: string;
  paymentReference: string;
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

export function renderInvoiceHtml(data: InvoiceTemplateData): { html: string; footerTemplate: string } {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${FONT_LINKS}
<style>${INVOICE_STYLES}</style>
</head>
<body>
  <div class="header-row-1">
    <span class="wordmark">Forma</span>
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

  <p class="thank-you">Thank you for choosing Forma.</p>
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate() };
}
