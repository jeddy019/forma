-- Adds the missing expires_at column so the /s/[code] route can enforce the
-- 30-day digital link expiry promised in CLAUDE.md's User Challenges section
-- (previously unenforced - the column never existed). The default expression
-- is evaluated per row at INSERT time, so every new worksheet gets its own
-- created_at + 30 days; existing rows (if any) get backfilled once, at
-- ALTER TABLE time, with the same single NOW() + 30 days value.
ALTER TABLE worksheets ADD COLUMN expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

CREATE INDEX idx_worksheets_expires_at ON worksheets(expires_at);
