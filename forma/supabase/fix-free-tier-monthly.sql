-- Changes the free tier from a 3-worksheet lifetime cap to 3 worksheets per
-- calendar month (recurring). Safe to run against the live project -
-- CREATE OR REPLACE is idempotent.

CREATE OR REPLACE FUNCTION check_and_log_generation(p_user_id UUID)
RETURNS BOOLEAN AS $func$
DECLARE v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  SELECT COUNT(*) INTO v_count FROM usage_log
  WHERE user_id = p_user_id AND action = 'generate'
  AND created_at >= date_trunc('month', NOW());
  IF v_count >= 3 THEN RETURN FALSE; END IF;
  INSERT INTO usage_log (user_id, action, metadata) VALUES (p_user_id, 'generate', '{}');
  RETURN TRUE;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
