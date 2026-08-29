// Founder model W5 (invoice-led billing): the monthly billing period for a
// family invoice. Pure + unit-tested, same discipline as familyPricing.ts.
//
// Decision (documented in CHANGELOG 2026-08-29): a family invoice covers ONE
// calendar month, and generation always targets the CURRENT month - the
// founder is a sole tutor who bills one family at a time from the Families
// page, so "this month" is the least surprising default and there is no
// history to walk back through. If an invoice for the current month already
// exists the generate action refuses instead of issuing a duplicate
// (UNIQUE (family_id, period_start) backs it up). Multiple months can stack
// naturally: the monthly rhythm just means next month's button issues then.

// Deterministic UTC boundaries - server clocks that skew across a midnight
// must agree on which month an invoice belongs to.
export function currentInvoicePeriod(now: Date, timeZone: string = 'UTC'): { start: Date; end: Date } {
  const parts = Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(now);
  const [year, month] = parts.split('-').map(Number);

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export function invoicePeriodLabel(period: { start: Date }): string {
  return period.start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// True when any provided invoice row opens on the same first-of-month as the
// period - the "already issued for this month" check. period_start arrives
// from PostgREST as a UTC ISO timestamp; slicing to the date part and
// comparing against the anchor avoids timezone drift on the row value.
export function hasInvoiceForPeriod(
  invoices: { period_start: string | null }[],
  period: { start: Date }
): boolean {
  const anchor = period.start.toISOString().slice(0, 10);
  return invoices.some((invoice) => (invoice.period_start ?? '').slice(0, 10) === anchor);
}