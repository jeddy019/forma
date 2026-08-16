-- Fixes a confirmed data exposure: the worksheets_public policy let ANY
-- anonymous request (no auth, no known digital_code) read every worksheet
-- row via the public anon key, including mark_scheme_json. Verified live by
-- inserting a test worksheet and reading it back with the anon key and no
-- filter at all.
--
-- Also adds the submissions policy that was missing entirely (RLS was
-- enabled with zero policies, which silently blocks the tutor marking
-- dashboard from ever reading its own data via an authenticated client).
--
-- After this, worksheets has no anon-visible policy at all. The /s/[code]
-- page and /api/submit must read/write via the service_role client
-- server-side (which bypasses RLS by design), filtering by digital_code and
-- selecting only student-safe columns.

DROP POLICY IF EXISTS worksheets_public ON worksheets;

CREATE POLICY submissions_owner ON submissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM worksheets
    WHERE worksheets.id = submissions.worksheet_id
    AND worksheets.owner_id = auth.uid()
  )
);
