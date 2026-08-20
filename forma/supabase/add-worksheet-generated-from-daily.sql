-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- Phase 7 Step 40 (Daily practice mode): worksheets.generated_from's CHECK
-- only allowed 'manual'/'scheduled' - daily-mode worksheets need their own
-- value so they can be told apart from a normal 10-question generation
-- (e.g. for reporting, or excluding them from anything that assumes a
-- full 10-question shape). The DROP uses IF EXISTS defensively since the
-- exact auto-generated constraint name couldn't be confirmed against the
-- live DB from this session - if it's wrong, this DROP just no-ops
-- harmlessly and the ADD CONSTRAINT below will surface a clear
-- "constraint already exists" error naming the real one to drop instead.
ALTER TABLE worksheets DROP CONSTRAINT IF EXISTS worksheets_generated_from_check;
ALTER TABLE worksheets ADD CONSTRAINT worksheets_generated_from_check
  CHECK (generated_from IN ('manual', 'scheduled', 'daily'));
