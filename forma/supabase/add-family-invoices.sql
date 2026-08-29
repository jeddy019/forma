-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files - not merged into schema.sql, which stays the
-- from-scratch bootstrap script).
--
-- Founder model W5 (invoice-led billing, decided with the user 2026-08-29):
-- the app issues the branded monthly bill per FAMILY and the founder marks
-- it paid/unpaid. Parents keep paying the founder directly - bank transfer
-- or whatever they already use - so this is a STATEMENT, not a payment
-- terminal: no Flutterwave call, no card collection, no student-facing
-- surface of any kind (the no-student-paywall invariant).
--
-- Separate from the existing `invoices` table on purpose: that table is the
-- SaaS-subscription RECEIPT written by the Flutterwave callback (plan
-- 'tutor'/'parent', payment_reference, USD) and W6 de-pro retires that path
-- entirely. A family bill has different shape (period, status, tier snapshot
-- in GBP) and different ownership (a FAMILY, not a user's own subscription),
-- so it gets its own table rather than forcing ALTERs onto the receipt
-- table it would muddle and then delete.
--
-- The amount is snapshotted from familyPricing.ts AT GENERATION TIME into
-- the row - familyPricing stays the only source for what a NEW invoice is
-- priced at, but an issued invoice keeps the number it was issued at even
-- if pricing later changes. invoice_number reuses the same sequence as the
-- SaaS table (nextval is monotonic, so numbers are globally unique across
-- both - no collision).
--
-- RLS keys on families.owner_id = auth.uid() exactly like family_members -
-- FOR ALL with USING (which doubles as WITH CHECK for writes) means a tutor
-- can only see/list/issue/update their own families' invoices.

CREATE TABLE IF NOT EXISTS family_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  payment_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- One issued bill per family per period - the generate action checks this
  -- too (so it can tell the founder "an invoice for this month already
  -- exists" instead of a constraint error), this is the backstop.
  UNIQUE (family_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_family_invoices_family ON family_invoices(family_id);

ALTER TABLE family_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY family_invoices_own ON family_invoices FOR ALL USING (
  EXISTS (
    SELECT 1 FROM families f
    WHERE f.id = family_invoices.family_id
      AND f.owner_id = auth.uid()
  )
);