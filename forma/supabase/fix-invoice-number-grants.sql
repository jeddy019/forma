-- Fixes "permission denied for sequence invoice_number_seq" - found live
-- while testing the invoice feature. grants.sql's ALTER DEFAULT PRIVILEGES
-- only covers TABLES created after it ran (see its own comment), not
-- SEQUENCES or FUNCTIONS - invoice_number_seq and generate_invoice_number()
-- were added later in add-invoices-table.sql and never got the equivalent
-- grant, so the service-role client's call to generate_invoice_number()
-- failed with Postgres error 42501 the first time it actually ran.
-- Safe to run against the live project - GRANT is idempotent.

GRANT ALL ON SEQUENCE invoice_number_seq TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number() TO authenticated, service_role;
