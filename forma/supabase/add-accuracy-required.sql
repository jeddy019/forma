-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- W5 B77 (accuracy-required mode): when TRUE, the quiz player blocks the
-- review screen whenever the student got questions wrong - wrong sub-skills
-- must be re-practised until correctly answered before the student moves on
-- ("must get correct before advancing"; wrong -> retry with a NEW VARIANT =
-- the existing B10 re-practice focused set). The re-practice loop is the
-- mechanism; this column is the per-student switch.
--
-- Founder-side dial only (PRODUCT EXPERIENCE MODEL): a student never sees
-- this control, and a parent asking for "more" gets the founder flipping it.
-- The student-facing sign is the review screen's accuracy-locked state.
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS accuracy_required BOOLEAN NOT NULL DEFAULT FALSE;