-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- W8 Wave D (automatic daily quiz + founder digest): the founder-side,
-- per-student automation dials the DAILY QUIZ section of CLAUDE.md describes.
-- Nothing here is ever shown to a student or a parent - difficulty and volume
-- controls are founder-side only (PRODUCT EXPERIENCE MODEL: "Difficulty/
-- volume dials are founder-side only; the portal only reflects what your
-- tutor has set").
--
-- practice_volume:      light (5/day) | standard (10, or 5 on higher-tier
--                       students) | deep (15/day)
-- difficulty_posture:   match (at current_difficulty) | push (one tier up)
--                       | consolidate (reinforce what they know)
-- holiday_posture:      normal | light (5 moderate questions, no push) |
--                       paused (no auto practice at all). Manual only -
--                       term dates differ across England/Ontario/US so no
--                       auto-detection is faked.
-- last_daily_generated_at: idempotency stamp so a retried/mislabelled cron
--                       run never mints two daily quizzes for one student
--                       on the same day.
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS practice_volume TEXT NOT NULL DEFAULT 'standard'
    CONSTRAINT student_profiles_practice_volume_check CHECK (practice_volume IN ('light', 'standard', 'deep')),
  ADD COLUMN IF NOT EXISTS difficulty_posture TEXT NOT NULL DEFAULT 'match'
    CONSTRAINT student_profiles_difficulty_posture_check CHECK (difficulty_posture IN ('match', 'push', 'consolidate')),
  ADD COLUMN IF NOT EXISTS holiday_posture TEXT NOT NULL DEFAULT 'light'
    CONSTRAINT student_profiles_holiday_posture_check CHECK (holiday_posture IN ('normal', 'light', 'paused')),
  ADD COLUMN IF NOT EXISTS last_daily_generated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_daily ON student_profiles(holiday_posture, last_daily_generated_at);