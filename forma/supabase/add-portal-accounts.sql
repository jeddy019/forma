-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- W8 Wave B (portal accounts): the PRODUCT EXPERIENCE MODEL's account layer.
-- Students and parents get auto-provisioned LOGIN credentials (a generated
-- username + password, shown once and resettable by the founder) instead of
-- a Supabase Auth email account - the founder model deliberately requires no
-- email address from a child ("No email address ever required" in CLAUDE.md).
-- One account per student (and one per family, the parent customer), username
-- + scrypt password hash, and throwaway session tokens stored hashed.
--
-- SECURITY: these tables are RLS-enabled with ZERO policies (deny-all to
-- anon/authenticated), the same pattern as usage_log / webhook_events /
-- question_bank - only the service-role admin client ever touches them (the
-- login/session code in src/lib/portal + the server actions). Never add a
-- public or authenticated policy here.
--
-- Students and parents NEVER hit a paywall (hardest invariant) - these
-- accounts only open the student's own progress portal and the parent's
-- view-only proof portal. Payment status is a soft signal on the founder's
-- dashboard only.

CREATE TABLE IF NOT EXISTS portal_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('student', 'parent')),
  student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  -- Credentials are generated once at enrollment and shown on screen (email
  -- is never required) - this records that the founder has acknowledged them
  -- so the founder-visible "show credentials" prompt knows when it is still
  -- needed. Null until first reset flows.
  password_reset_at TIMESTAMPTZ,
  -- Brute-force throttle: failed attempts are counted per account and the
  -- account is locked for 15 minutes after a threshold. Rejected in app code
  -- (login action), these columns persist the state.
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT portal_account_target_exactly_one CHECK (
    (kind = 'student' AND student_id IS NOT NULL AND family_id IS NULL)
    OR (kind = 'parent' AND family_id IS NOT NULL AND student_id IS NULL)
  )
);

-- One portal account per student / per family (NULLs are ignored by UNIQUE,
-- but the CHECK above already guarantees only the owning kind has a value).
CREATE UNIQUE INDEX IF NOT EXISTS portal_account_student_unique ON portal_accounts(student_id) WHERE student_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS portal_account_family_unique ON portal_accounts(family_id) WHERE family_id IS NOT NULL;

-- Username is matched case-insensitively at login, so uniqueness is enforced
-- on the lowercased form.
CREATE UNIQUE INDEX IF NOT EXISTS portal_account_username_unique ON portal_accounts (LOWER(username));

CREATE TABLE IF NOT EXISTS portal_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES portal_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_account ON portal_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token_hash);

ALTER TABLE portal_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_sessions ENABLE ROW LEVEL SECURITY;