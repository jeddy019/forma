-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- Phase B W2 (weekly branded proof report): the report is hard data
-- (worksheets, scores, strongest/weakest area) plus the founder's own voice
-- as a short personal note. Two columns make that work:
--
--   report_note - the standing note shown on every AUTO-sent weekly report
--   for this student ("founder's voice" without the founder being online).
--   NULL means "no standing note yet" - auto sends fall back to a graceful
--   default framing line instead. The manual send on the student page can
--   also override it with a fresh note typed at send time.
--
--   last_report_sent_at - the last time a weekly report was sent for this
--   student, guarding the weekly cron against double-sends in the same
--   cycle (the same 6-day "already done this week" guard the generation
--   cron uses on schedules.last_generated_at). NULL = never sent.
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS report_note TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS last_report_sent_at TIMESTAMPTZ;