import { describe, expect, it } from 'vitest';
import { currentInvoicePeriod, hasInvoiceForPeriod, invoicePeriodLabel } from '@/lib/invoices/familyBilling';

describe('currentInvoicePeriod', () => {
  it('returns the first and last instant of the current UTC month', () => {
    const period = currentInvoicePeriod(new Date(Date.UTC(2026, 8, 15, 12, 0, 0)));
    expect(period.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-09-30T23:59:59.999Z');
  });

  it('handles December and February boundaries', () => {
    expect(currentInvoicePeriod(new Date(Date.UTC(2026, 11, 3))).end.toISOString()).toBe('2026-12-31T23:59:59.999Z');
    expect(currentInvoicePeriod(new Date(Date.UTC(2027, 1, 10))).end.toISOString()).toBe('2027-02-28T23:59:59.999Z');
    expect(currentInvoicePeriod(new Date(Date.UTC(2028, 1, 10))).end.toISOString()).toBe('2028-02-29T23:59:59.999Z');
  });
});

describe('invoicePeriodLabel', () => {
  it('formats a month as "September 2026"', () => {
    expect(invoicePeriodLabel({ start: new Date(Date.UTC(2026, 8, 1)) })).toBe('September 2026');
  });
});

describe('hasInvoiceForPeriod', () => {
  const period = currentInvoicePeriod(new Date(Date.UTC(2026, 8, 1)));

  it('is true when an invoice opens on the same first-of-month', () => {
    expect(hasInvoiceForPeriod([{ period_start: '2026-09-01T00:00:00.000Z' }], period)).toBe(true);
    expect(
      hasInvoiceForPeriod(
        [{ period_start: '2026-08-01T00:00:00.000Z' }, { period_start: '2026-09-01T00:00:00.000Z' }],
        period
      )
    ).toBe(true);
  });

  it('is false for an earlier month, no invoices, or null periods', () => {
    expect(hasInvoiceForPeriod([{ period_start: '2026-08-01T00:00:00.000Z' }], period)).toBe(false);
    expect(hasInvoiceForPeriod([], period)).toBe(false);
    expect(hasInvoiceForPeriod([{ period_start: null }], period)).toBe(false);
  });
});