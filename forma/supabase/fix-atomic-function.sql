-- Fixes check_and_log_generation: the original definition used
-- "SELECT COUNT(*) ... FOR UPDATE", which Postgres rejects (FOR UPDATE
-- cannot be combined with an aggregate function). Confirmed by calling the
-- function directly, which returned: "FOR UPDATE is not allowed with
-- aggregate functions" (Postgres error 0A000).
--
-- This replaces it with a per-user advisory lock, which gives the same
-- atomicity guarantee (no two concurrent requests for the same user can
-- both pass the free-tier check) without the invalid FOR UPDATE usage.
-- Safe to run against the live project - CREATE OR REPLACE is idempotent.

CREATE OR REPLACE FUNCTION check_and_log_generation(p_user_id UUID)
RETURNS BOOLEAN AS $func$
DECLARE v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  SELECT COUNT(*) INTO v_count FROM usage_log
  WHERE user_id = p_user_id AND action = 'generate';
  IF v_count >= 3 THEN RETURN FALSE; END IF;
  INSERT INTO usage_log (user_id, action, metadata) VALUES (p_user_id, 'generate', '{}');
  RETURN TRUE;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
