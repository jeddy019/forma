-- Run this once in the Supabase SQL Editor, after schema.sql.
-- Fixes "permission denied for table X" errors on anon/authenticated/service_role.
-- RLS policies (already created by schema.sql) still restrict which ROWS each
-- role can see - these grants only restore the baseline table-level access
-- that Supabase normally sets up automatically for new tables.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

GRANT EXECUTE ON FUNCTION public.check_and_log_generation(uuid) TO authenticated, service_role;

-- Keep these grants applying automatically to any table created later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
