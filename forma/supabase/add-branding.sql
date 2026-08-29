-- Standalone addition, run manually in Supabase SQL Editor (same pattern as
-- the other add-*.sql files).
--
-- W1 identity layer (see CLAUDE.md "Build Phases" note): the founder's own
-- account now runs the platform as a personalised practice system under the
-- founder's name, not the "Forma" product brand. These two columns let the
-- account carry its own brand and feed every surface (dashboard wordmark,
-- worksheet/mark-scheme/invoice PDF wordmarks and footers, and later the
-- email templates and public pages) from one place.
--
-- brand_name: NULL means "unset", resolver falls back to the platform
-- default ("Forma"). Max 100 chars enforced by the settings action, not a
-- CHECK - same loose-TEXT pattern as curriculum_level.
-- brand_accent: NULL means "unset", resolver falls back to the design
-- system's primary green (#1A3D2E). Stored as plain TEXT so it can hold a
-- 3/6-digit hex; the settings action validates it against a hex regex and
-- normalises it to #RRGGBB before storing, so the DB only ever holds clean
-- values from our own UI.
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_accent TEXT;