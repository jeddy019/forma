-- W5 B78 (Streak freeze): store the days a student's streak was protected by
-- a monthly freeze. Comma-separated UTC 'YYYY-MM-DD' labels - see
-- src/lib/streak/streak.ts for the parse/serialize helpers and the
-- one-freeze-per-calendar-month rule (keyed on the missed day's month).
-- One day per month at most, so the column stays tiny.
--
-- Idempotent so this file can be re-run safely. Run in the Supabase SQL editor.
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS streak_freeze_days TEXT;