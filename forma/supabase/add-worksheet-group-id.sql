-- Standalone fix, applied live to the production Supabase project.
-- Phase 6 Step 31 (Group mode): ties multiple worksheets.rows together as
-- one shared generation - "one worksheet, multiple students." Not a
-- foreign key (there is no separate "worksheet_groups" table, and none is
-- needed - a shared random UUID across N rows is the entire mechanism).
-- Null for every worksheet generated outside group mode.
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS group_id UUID;
CREATE INDEX IF NOT EXISTS idx_worksheets_group ON worksheets(group_id);
