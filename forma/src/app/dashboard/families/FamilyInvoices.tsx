'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import {
  generateFamilyInvoiceAction,
  markFamilyInvoicePaidAction,
  markFamilyInvoicePendingAction,
  type FamilyActionResult,
} from './actions';
import { inputClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui/formStyles';
import { invoicePeriodLabel } from '@/lib/invoices/familyBilling';
import { EmptyState } from '@/lib/ui/EmptyState';

export interface FamilyInvoiceRow {
  family_id: string;
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid';
  period_start: string;
  paid_at: string | null;
  payment_note: string | null;
}

function amountLabel(amount: number, currency: string): string {
  return `${currency === 'GBP' ? '£' : `${currency} `}${Number(amount).toLocaleString('en-GB')}`;
}

// W5 invoice-led billing: the per-family statement history. Pure founder
// surface - generate the month's bill, mark it paid when the parent pays
// directly, re-open it if it was a mistake, download the branded PDF to
// send. Deliberately no student-facing element anywhere in this card: a
// child opening their /s/[code] or /q/[code] link never learns an invoice
// exists (no-student-paywall invariant).
export default function FamilyInvoices({
  familyId,
  childCount,
  currentPeriodLabel,
  hasCurrentInvoice,
  invoices,
}: {
  familyId: string;
  childCount: number;
  currentPeriodLabel: string;
  hasCurrentInvoice: boolean;
  invoices: FamilyInvoiceRow[];
}) {
  const [generating, setGenerating] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [openPaidForm, setOpenPaidForm] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function run(action: () => Promise<FamilyActionResult>) {
    setMessage(null);
    const result = await action();
    if (result.error) setMessage({ kind: 'error', text: result.error });
    else setMessage({ kind: 'ok', text: 'Saved.' });
  }

  async function handleGenerate() {
    setGenerating(true);
    await run(() => generateFamilyInvoiceAction(familyId));
    setGenerating(false);
  }

  async function handleMarkPaid(invoiceId: string, note: string) {
    setMarkingId(invoiceId);
    await run(() => markFamilyInvoicePaidAction(invoiceId, note));
    setMarkingId(null);
    setOpenPaidForm(null);
    setNoteInputs((current) => ({ ...current, [invoiceId]: '' }));
  }

  async function handleMarkPending(invoiceId: string) {
    setMarkingId(invoiceId);
    await run(() => markFamilyInvoicePendingAction(invoiceId));
    setMarkingId(null);
  }

  const canGenerate = childCount >= 1 && childCount <= 3 && !hasCurrentInvoice;

  return (
    <div className="border-t border-[#E0D9D0] pt-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#1A1A18]">Invoices</p>
        {canGenerate && (
          <button type="button" onClick={handleGenerate} disabled={generating} className={primaryButtonClass}>
            {generating ? 'Generating...' : `Invoice for ${currentPeriodLabel}`}
          </button>
        )}
      </div>

      {childCount === 0 && (
        <p className="text-xs text-[#9A9080] italic">Add children first - invoices are priced by the family tier (1-3 children).</p>
      )}

      {!canGenerate && childCount >= 1 && hasCurrentInvoice && (
        <p className="text-xs text-[#9A9080] italic">An invoice for {currentPeriodLabel} already exists.</p>
      )}

      {invoices.length === 0 && childCount >= 1 && (
        <EmptyState icon={FileText} message="No invoices yet - generate this month's bill above." />
      )}

      {invoices.map((invoice) => {
        const periodLabel = invoicePeriodLabel({ start: new Date(invoice.period_start) });
        const note = noteInputs[invoice.id] ?? '';
        return (
          <div key={invoice.id} className="flex flex-col gap-1 py-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[#1A1A18]">{periodLabel}</p>
                <p className="text-xs text-[#9A9080]">
                  {invoice.invoice_number} - {amountLabel(invoice.amount, invoice.currency)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {invoice.status === 'paid' ? (
                  <span className="text-xs bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2.5 py-1">
                    Paid{invoice.paid_at ? ` ${new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                  </span>
                ) : (
                  <span className="text-xs bg-[#FEF9EC] text-[#B8963C] border border-[#C8A84B] rounded-full px-2.5 py-1">
                    Payment due
                  </span>
                )}
                <Link
                  href={`/api/family-invoices/${invoice.id}/pdf`}
                  className="inline-flex items-center gap-1.5 text-sm text-[#5C5849] hover:text-[#1A3D2E] transition-colors duration-micro ease-premium"
                  title="Download PDF"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
                  PDF
                </Link>
                {invoice.status === 'paid' ? (
                  <button
                    type="button"
                    onClick={() => handleMarkPending(invoice.id)}
                    disabled={markingId === invoice.id}
                    className="text-xs text-[#9A9080] hover:text-[#C0392B] transition-colors duration-micro ease-premium disabled:opacity-60"
                  >
                    {markingId === invoice.id ? 'Undoing...' : 'Mark unpaid'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenPaidForm((current) => (current === invoice.id ? null : invoice.id))}
                    className="text-xs text-[#1A3D2E] hover:text-[#152F23] transition-colors duration-micro ease-premium"
                  >
                    Mark paid
                  </button>
                )}
              </div>
            </div>

            {invoice.status === 'pending' && openPaidForm === invoice.id && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={note}
                  maxLength={200}
                  onChange={(event) => setNoteInputs((current) => ({ ...current, [invoice.id]: event.target.value }))}
                  placeholder="Optional: how they paid (e.g. Bank transfer, Cash)"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => handleMarkPaid(invoice.id, note)}
                  disabled={markingId === invoice.id}
                  className={`${secondaryButtonClass} shrink-0`}
                >
                  {markingId === invoice.id ? 'Saving...' : 'Confirm paid'}
                </button>
              </div>
            )}

            {invoice.paid_at && invoice.payment_note && (
              <p className="text-xs text-[#5C5849]">Payment: {invoice.payment_note}</p>
            )}
          </div>
        );
      })}

      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-[#1A3D2E]' : 'text-[#C0392B]'}`}>{message.text}</p>}
    </div>
  );
}