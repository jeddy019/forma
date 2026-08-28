-- Forma database schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to run top to bottom in a single execution.

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('tutor', 'parent', 'student')),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  plan_expires_at TIMESTAMPTZ,
  region TEXT,
  paper_size TEXT DEFAULT 'a4' CHECK (paper_size IN ('a4', 'letter')),
  -- Phase 5 (Payment): set once a Flutterwave payment-plan subscription is
  -- created, on the first successful charge - needed to call Flutterwave's
  -- own cancel-subscription API later. Null on the free plan.
  flutterwave_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT CHECK (country IN ('england', 'canada_ontario', 'united_states')),
  curriculum_level TEXT,
  year_level TEXT,
  -- Optional exam board (England AQA/Edexcel/OCR/CIE, US SAT/ACT) so
  -- generation matches board style - see supabase/add-exam-board.sql.
  exam_board TEXT,
  subjects TEXT[],
  weaknesses TEXT,
  current_difficulty TEXT DEFAULT 'standard',
  -- Optional - never required. Tutor/parent is data controller, Forma is
  -- data processor (see CLAUDE.md's Student Accounts and Data Processor
  -- Status). When set, worksheet-ready/weekly-delivery emails go straight
  -- to the student instead of the account owner.
  email TEXT,
  -- Kumon Methodology: per-sub-skill mastery state. Empty until Phase 7.
  skill_map JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  student_id UUID REFERENCES student_profiles(id),
  prompt_used TEXT,
  questions_json JSONB NOT NULL,
  mark_scheme_json JSONB,
  alignment_note TEXT,
  worksheet_pdf_url TEXT,
  mark_scheme_pdf_url TEXT,
  digital_code TEXT UNIQUE,
  qr_code_svg TEXT,
  subject TEXT,
  topic TEXT,
  difficulty TEXT,
  paper_size TEXT DEFAULT 'a4',
  difficulty_feedback TEXT CHECK (difficulty_feedback IN ('too_easy','just_right','too_hard',NULL)),
  generated_from TEXT DEFAULT 'manual' CHECK (generated_from IN ('manual','scheduled','daily')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Enforces the 30-day digital link expiry promised in User Challenges -
  -- see supabase/add-worksheet-expiry.sql for the standalone fix, applied
  -- live in Phase 2 Step 13.
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  -- Phase 6 Step 31 (Group mode): shared across every worksheet row
  -- generated together for a group ("one worksheet, multiple students") -
  -- not a foreign key, just a random UUID common to that batch. Null
  -- outside group mode. See supabase/add-worksheet-group-id.sql.
  group_id UUID,
  -- Phase 7 Step 39 (Speed awareness): set once, the first time /s/[code]
  -- is opened for this worksheet - captures a real "started working on
  -- it" event that created_at (generation time) can't. Null until then.
  -- See supabase/add-worksheet-first-opened-at.sql.
  first_opened_at TIMESTAMPTZ
);

CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID REFERENCES worksheets(id),
  student_id UUID REFERENCES student_profiles(id),
  answers_json JSONB,
  auto_marks_json JSONB,
  ai_suggested_marks_json JSONB,
  tutor_marks_json JSONB,
  tutor_feedback TEXT,
  score_percentage INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES student_profiles(id),
  subject TEXT,
  topics TEXT[],
  difficulty TEXT DEFAULT 'standard',
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  delivery_hour INTEGER CHECK (delivery_hour BETWEEN 0 AND 23),
  delivery_timezone TEXT DEFAULT 'Europe/London',
  is_paused BOOLEAN DEFAULT FALSE,
  paused_until TIMESTAMPTZ,
  last_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID REFERENCES users(id),
  student_id UUID REFERENCES student_profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  subject TEXT,
  difficulty TEXT,
  question_count INTEGER DEFAULT 10,
  has_diagrams BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT,
  event_id TEXT UNIQUE,
  event_type TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kumon Methodology: human-verified question bank (Phase 7 Step 42). Not
-- user-owned - educators write/verify these, generation reads them
-- server-side only. See the RLS note below (zero policies, same as
-- usage_log/webhook_events).
CREATE TABLE question_bank (
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

-- Indexes
CREATE INDEX idx_worksheets_owner ON worksheets(owner_id);
CREATE INDEX idx_worksheets_student ON worksheets(student_id);
CREATE INDEX idx_worksheets_code ON worksheets(digital_code);
CREATE INDEX idx_worksheets_expires_at ON worksheets(expires_at);
CREATE INDEX idx_worksheets_group ON worksheets(group_id);
CREATE INDEX idx_profiles_owner ON student_profiles(owner_id);
CREATE INDEX idx_submissions_worksheet ON submissions(worksheet_id);
CREATE INDEX idx_schedules_owner ON schedules(owner_id);
CREATE INDEX idx_schedules_paused ON schedules(is_paused);
CREATE INDEX idx_notes_student ON session_notes(student_id);
CREATE INDEX idx_usage_user_action ON usage_log(user_id, action);
CREATE INDEX idx_question_bank_lookup ON question_bank(country, curriculum_level, subject, sub_skill);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY users_own ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY profiles_own ON student_profiles FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY worksheets_own ON worksheets FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY schedules_own ON schedules FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY notes_own ON session_notes FOR ALL USING (auth.uid() = tutor_id);
CREATE POLICY templates_own ON templates FOR ALL USING (auth.uid() = tutor_id);
CREATE POLICY submissions_owner ON submissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM worksheets
    WHERE worksheets.id = submissions.worksheet_id
    AND worksheets.owner_id = auth.uid()
  )
);

-- No public/anon SELECT policy on worksheets. The /s/[code] page and the
-- student submit flow must use the service_role client server-side, filtering
-- by digital_code and selecting only student-safe columns - never
-- mark_scheme_json. An anon-visible policy here would expose every worksheet
-- (including its mark scheme) to anyone with the public anon key, not just
-- the one row matching the code the student was given: RLS filters rows by a
-- stored predicate, not by what the caller's WHERE clause claims to look for,
-- so "digital_code IS NOT NULL" would match nearly every row for any anon
-- query, with or without a code. Confirmed live: an anon SELECT with no
-- filter and no known code returned another user's full worksheet row,
-- mark scheme included.
--
-- usage_log, webhook_events, and question_bank also have no policy beyond
-- RLS-enabled: none is ever queried by an authenticated client (usage_log is
-- written only by the SECURITY DEFINER function below, which runs as the
-- table owner and bypasses RLS; webhook_events and question_bank are
-- service_role-only), so "enabled with zero policies" (deny-all to
-- anon/authenticated) is correct for all three, not an oversight.

-- Atomic free tier function
CREATE OR REPLACE FUNCTION check_and_log_generation(p_user_id UUID)
RETURNS BOOLEAN AS $func$
DECLARE v_count INTEGER;
BEGIN
  -- Serializes concurrent calls for the same user for the rest of this
  -- transaction. "SELECT COUNT(*) ... FOR UPDATE" is invalid in Postgres
  -- (FOR UPDATE cannot be combined with an aggregate), so a per-user
  -- advisory lock is used instead to get the same atomicity guarantee.
  -- Free tier is 3 worksheets per calendar month, not a lifetime cap.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  SELECT COUNT(*) INTO v_count FROM usage_log
  WHERE user_id = p_user_id AND action = 'generate'
  AND created_at >= date_trunc('month', NOW());
  IF v_count >= 3 THEN RETURN FALSE; END IF;
  INSERT INTO usage_log (user_id, action, metadata) VALUES (p_user_id, 'generate', '{}');
  RETURN TRUE;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
