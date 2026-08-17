-- Standalone fix, applied live to the production Supabase project.
-- Adds the Student Accounts (optional email) and Kumon Methodology
-- (skill_map, question_bank) additions to CLAUDE.md's Database Schema.
-- See CHANGELOG.md for the session this was applied in.

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS skill_map JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS question_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT,
  curriculum_level TEXT,
  subject TEXT,
  topic TEXT,
  sub_skill TEXT,
  question_json JSONB,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_lookup ON question_bank(country, curriculum_level, subject, sub_skill);

ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
-- Deliberately no policy - service_role-only table, same pattern as
-- usage_log/webhook_events. See schema.sql's comment for the full reasoning.
