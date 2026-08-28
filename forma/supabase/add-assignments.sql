-- Phase B Wave 5 (B73): Assignment loop tracking. One row per assignment - a
-- named container around a group generation ("one worksheet, multiple
-- students"). Each worksheet generated under that assignment carries
-- assignment_id, seeded by /api/generate/group (its value doubles as the
-- group_id, so the pre-B73 group comparison page at
-- /dashboard/generate/group/[groupId] resolves the same worksheets).
-- Per-student status (not_started / in_progress / submitted / reviewed) is
-- derived at read time from the worksheet's first_opened_at plus its latest
-- submission - nothing here is stored proactively.
--
-- Owner-held (owner_id -> users), RLS-scoped by auth.uid() exactly like
-- every other dashboard-owned table. Applied live to the production project.
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ON DELETE SET NULL: removing an assignment row keeps the worksheets alive
-- (a worksheet is independently usable via its digital link and marking
-- queue); the assignment is only the tracking wrapper.
ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_owner ON assignments(owner_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_assignment ON worksheets(assignment_id);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_own ON assignments FOR ALL USING (auth.uid() = owner_id);