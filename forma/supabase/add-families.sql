-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files - not merged into schema.sql, which stays the
-- from-scratch bootstrap script).
--
-- Founder model W4 (family plan, decided with the user 2026-08-29): a
-- Family is one parent customer of the founder's, grouping 1-3 of their
-- children into a single monthly tier (£99 / £170 / £240 - see
-- src/lib/payments/familyPricing.ts, the ONLY place those numbers live).
-- W5 (invoice-led billing) will issue one branded invoice per family row;
-- nothing bills off these tables until then, and no student-facing surface
-- ever reads them (the no-student-paywall invariant).
--
-- A student belongs to AT MOST ONE family (enforced by the UNIQUE on
-- student_id). A family is capped at THREE children (enforced here by the
-- BEFORE INSERT trigger - the UI and server actions check the same rule,
-- the trigger is the DB backstop so the cap can never drift).
--
-- RLS: families are tutor-owner-scoped like student_profiles. family_members
-- requires BOTH sides owned by the caller (the family AND the student), so a
-- tutor can never attach someone else's student to their family.

CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_members (
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  student_id UUID UNIQUE REFERENCES student_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (family_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_families_owner ON families(owner_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY families_own ON families FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY family_members_own ON family_members FOR ALL USING (
  EXISTS (
    SELECT 1 FROM families f, student_profiles sp
    WHERE f.id = family_members.family_id
      AND f.owner_id = auth.uid()
      AND sp.id = family_members.student_id
      AND sp.owner_id = auth.uid()
  )
);

-- DB-level backstop for the 3-children cap (the offer defines no 4+ tier).
CREATE OR REPLACE FUNCTION enforce_family_children_cap() RETURNS trigger AS $func$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM family_members WHERE family_id = NEW.family_id;
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'family_children_cap_reached';
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_family_children_cap_trg ON family_members;
CREATE TRIGGER enforce_family_children_cap_trg
  BEFORE INSERT ON family_members
  FOR EACH ROW EXECUTE FUNCTION enforce_family_children_cap();