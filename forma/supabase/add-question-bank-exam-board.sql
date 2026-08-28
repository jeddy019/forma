-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- Phase B Wave 4 Step 68 (board-filtered question retrieval): lets admin
-- curation tag a verified question_bank row with the exam board its style
-- matches (England AQA/Edexcel/OCR/CIE, US SAT/ACT). Generation then prefers
-- rows tagged with a student's pinned board while still accepting
-- board-agnostic (NULL) rows; rows from a different board are excluded.
-- Same unconstrained TEXT pattern as student_profiles.exam_board - NULL just
-- means "no board in particular".
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS exam_board TEXT;
CREATE INDEX IF NOT EXISTS idx_question_bank_board ON question_bank(exam_board);