-- Adds 'quiz' to the generated_from CHECK constraint on worksheets.
-- Quizzes use the same generation pipeline as worksheets but with a
-- different presentation layer (interactive at /q/[code] instead of PDF).

ALTER TABLE worksheets
  DROP CONSTRAINT IF EXISTS worksheets_generated_from_check;

ALTER TABLE worksheets
  ADD CONSTRAINT worksheets_generated_from_check
  CHECK (generated_from IN ('manual', 'scheduled', 'daily', 'quiz'));
