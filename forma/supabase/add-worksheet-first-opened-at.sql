-- Standalone fix, applied live to the production Supabase project.
-- Phase 7 Step 39 (Speed awareness): "Log worksheet delivery time and
-- submission time" - worksheets.created_at is when it was GENERATED, not
-- when the student actually started working on it. This captures the
-- real start event: set once, the first time /s/[code] is opened for
-- this worksheet. Null for a worksheet nobody has opened yet.
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS first_opened_at TIMESTAMPTZ;
