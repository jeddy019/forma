-- Phase B Wave 1 (B7): Spaced Repetition - opt-in schedule per student per
-- sub-skill. One row per (student_id, sub_skill); a student (or their tutor)
-- opts in to spaced review for a sub-skill they want to retain.
--
-- Mirrors CLAUDE.md's documented ladder (1d, 3d, 7d, 14d, 30d) via
-- interval_days/ladder_step. sub_skill stores the slug key so SRS rows share
-- one sub-skill identity with skill_map (mastery/types.ts). New table, no
-- column changes to existing tables. Applied live to the production project.

CREATE TABLE IF NOT EXISTS review_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  sub_skill TEXT NOT NULL,
  sub_skill_label TEXT NOT NULL,
  topic TEXT,
  next_review_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  interval_days INTEGER NOT NULL DEFAULT 1,
  ladder_step INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, sub_skill)
);

CREATE INDEX IF NOT EXISTS idx_review_schedule_student ON review_schedule(student_id);
CREATE INDEX IF NOT EXISTS idx_review_schedule_due ON review_schedule(next_review_at);

-- RLS: ownership is derived from the student the schedule belongs to (a
-- tutor/parent's server client, scoped by auth.uid() via the join). The
-- student portal reads via the service-role admin client (same pattern as
-- /student reading skill_map - students have no auth.uid() that RLS can
-- match), which bypasses RLS, so no anon policy is needed or wanted.
ALTER TABLE review_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY review_schedule_owner ON review_schedule FOR ALL USING (
  EXISTS (
    SELECT 1 FROM student_profiles
    WHERE student_profiles.id = review_schedule.student_id
    AND student_profiles.owner_id = auth.uid()
  )
);
