-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files - not merged into schema.sql, which stays the
-- from-scratch bootstrap script).
--
-- Billing history for the Settings page + EMAIL 6 (payment confirmed)
-- attachment. Written only by activateSubscriptionFromTransaction via the
-- service-role client (createAdminClient) after a Flutterwave charge is
-- independently verified server-side - never by an authenticated user
-- directly, so there is no client-facing INSERT/UPDATE policy, only SELECT.
--
-- No pdf_url is ever populated - this project never stores PDFs anywhere
-- (worksheet_pdf_url/mark_scheme_pdf_url on the worksheets table are the
-- same kind of unused column; worksheet PDFs are regenerated on demand via
-- /api/pdf instead of being stored). The column stays for schema
-- shape-compatibility and in case a future session decides storage is
-- worth it, but /api/invoices/[id]/pdf regenerates from the row's own
-- data every time, the same way /api/pdf regenerates from questions_json.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  payment_reference TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('tutor', 'parent')),
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_own_select ON invoices FOR SELECT USING (auth.uid() = user_id);

-- Sequential numbering, global and monotonic (never resets per year - only
-- the year label attached to each number changes). Using a real SEQUENCE
-- rather than a count-then-insert query means nextval() is atomic by
-- Postgres's own guarantee - no advisory-lock dance needed, unlike
-- check_and_log_generation's free-tier counter (see fix-atomic-function.sql),
-- which had to work around COUNT(*) not being lockable directly.
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $func$
DECLARE v_seq INTEGER;
BEGIN
  v_seq := nextval('invoice_number_seq');
  RETURN 'FORMA-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$func$ LANGUAGE plpgsql;

-- grants.sql's ALTER DEFAULT PRIVILEGES only covers TABLES created after it
-- ran, not SEQUENCES or FUNCTIONS - both need an explicit grant here or the
-- service-role client's call to generate_invoice_number() fails with
-- Postgres error 42501 ("permission denied for sequence"). Found live the
-- first time this was actually tested - see fix-invoice-number-grants.sql
-- for the standalone version of this same fix, for anyone who already ran
-- this file before the fix was added.
GRANT ALL ON SEQUENCE invoice_number_seq TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated, service_role;
