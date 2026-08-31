-- W5 B75 (Cram mode): worksheets.generated_from's CHECK constraint does not
-- yet admit the quiz-mode values. The cram route writes 'cram'; the quiz
-- (B11), re-practice (B12) and study (B11) routes write 'quiz' / 're-practice'
-- / 'study'. Only 'manual', 'scheduled' and 'daily' were permitted, so every
-- non-daily quiz-mode insert was failing (live reproduction: cram returned
-- 500 "violates check constraint worksheets_generated_from_check").
--
-- Set the full set of in-use values in one idempotent drop-and-re-add so this
-- file can be re-run safely. Run in the Supabase SQL editor.
ALTER TABLE worksheets DROP CONSTRAINT IF EXISTS worksheets_generated_from_check;
ALTER TABLE worksheets ADD CONSTRAINT worksheets_generated_from_check
  CHECK (generated_from IN ('manual', 'scheduled', 'daily', 'quiz', 're-practice', 'study', 'cram'));
