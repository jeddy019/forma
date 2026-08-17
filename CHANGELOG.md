# FORMA - Build Changelog

Full session-by-session history: what was completed, decisions made and why,
bugs found and fixed, and verification performed. CLAUDE.md's Current Build
Status section only holds a 5-line snapshot (completed / next / open risks);
this file is the detailed record behind it.

Append a new entry here at the end of every session, in the same format as
the ones below:

```
SESSION UPDATE (following the one above):
Completed: Phase [X] Step [Y] - [what was done, verification performed]
Next: Phase [X] Step [Y+1] - [what comes next]
Decisions: [any approved changes from the plan, or "none"]
```

Then update CLAUDE.md's Current Build Status to match (5 lines max).

---

CURRENT STATUS (Phase 1 - Phase 2 Steps 7-8):
Completed: Phase 1 (all steps), Phase 2 Steps 7 and 8, plus a full
security/product review of this file with all four open questions decided
(see Decisions). Phase 1: project scaffolded (Next.js 16, React 19,
Tailwind v4); design tokens in globals.css via @theme inline block;
boilerplate removed, cream background confirmed in dev server; vercel.json
created; Supabase client helpers (src/lib/supabase/client.ts, server.ts);
protected-route proxy at src/proxy.ts; schema.sql and grants.sql run by the
user, plus three further fixes applied directly to the live DB (atomic
function bug, worksheets_public RLS hole, free tier switched from lifetime
to monthly - all three detailed below). Phase 2 Step 7: Puppeteer browser
pool built at src/lib/pdf/browser-pool.ts and smoke-tested locally (generated
a real PDF via local Chrome fallback). Phase 2 Step 8: diagram SVG library
built at src/lib/diagrams/ - all 8 functions from the spec (drawCoordinateGrid,
drawTriangle, drawRightAngleTriangle, drawBarChart, drawPieChart,
drawNumberLine, drawCircle, drawTable), colours matching the Diagram Colour
System exactly, plus colors.ts (shared hex constants) and types.ts (shared
Point/GridPoint/GridLine types). All 8 verified visually, not just
compiled: rendered a sample of each via Puppeteer + local Chrome, screenshotted,
and inspected the image directly - confirmed correct colours, shapes, and
label placement (including that drawRightAngleTriangle correctly shows "?"
on the side passed as labelledSide, and drawNumberLine correctly draws an
open circle for a non-filled marked point). Barrel-exported from
src/lib/diagrams/index.ts.

Some parameter behaviour wasn't fully pinned down by the spec (only function
signatures were given, not exact semantics) - documented here as the design
decisions actually made, since a future session or the PDF template phase
will need to match these when calling in:

- drawTriangle/drawRightAngleTriangle take geometry in abstract SVG units,
  not real-world lengths tied to a coordinate grid - they're standalone
  shape diagrams, not plotted on drawCoordinateGrid's axes.
  drawRightAngleTriangle scales base/height proportionally against each
  other (so a 3-4-5 triangle actually looks 3:4 in the drawing) and displays
  "?" instead of the number for whichever side is passed as labelledSide -
  the standard "work out the missing side" worksheet pattern.
- drawBarChart's colours param is an array of 'primary' | 'secondary' per
  bar (for comparison/grouped bars), not a raw hex-colour array - defaults
  to all-primary if omitted.
- drawNumberLine's markedPoints take filled: false for an open circle
  (strict inequality convention); arrows take either a bounded {from, to} or
  an open-ended ray via {from, direction} with no to.
- drawCircle always draws one radius line at angle 0 labelled with the
  numeric radius value; angles/sectors are additional markings layered on
  top (dashed angle lines with degree labels, shaded sector wedges at
  opacity 0.18 per the colour system). label is the centre-point label (e.g.
  "O"), not a radius label.
- drawPieChart and drawTable auto-size from their inputs (pie adds a colour
  swatch legend to the right since slices alone aren't identifiable; table
  computes column width from the longest cell in each column).

Next: Phase 2 Step 12 (continued) - Generation UI proper (input box, prompt
helper, topic picker, loading state with Cancel button, debounced difficulty
buttons, A4/Letter download buttons) plus the /api/pdf route it needs for
the download buttons to actually do anything (that route was never a
numbered Build Phase step either - see the Decision below). Before Phase 2
Step 13 (/s/[code] page), add a worksheets.expires_at column and enforce the
promised 30-day link expiry (currently unenforced - see User Challenges
section). Before Phase 3, set up a test framework (see Testing Strategy -
currently no test runner installed).

Decisions (this session, all confirmed by the user):

1. Dropped Paystack entirely. It was only being considered for the founder's
   own payout convenience (Nigeria-based), not because of real Nigerian
   customer demand - confirmed with the user there is essentially no
   Nigerian customer base for this product. Verified Flutterwave already
   covers the actual need: it holds a Nigerian banking license (secured
   April 2026) and supports payout to Nigerian bank accounts while accepting
   payments from customers globally - the exact "African founder,
   international customers" case it's built for. See Tech Stack Payments
   line for the full reasoning and a reminder to confirm NGN payout is
   enabled on the account. All Paystack references removed: Tech Stack,
   Security Rules 6, Environment Variables (both here and the real
   .env.local), Routing Structure, Build Phases Phase 5.
2. Free tier changed from 3 worksheets lifetime to 3 worksheets per calendar
   month, recurring. Reasoning: a permanent lifetime cutoff works against
   Principle 6 ("tutors show it to other tutors") once a free user hits zero
   forever. check_and_log_generation now filters usage_log to the current
   month (date_trunc('month', NOW())) instead of counting all-time. Applied
   live to the database, updated in schema.sql, and both copies embedded in
   this file (Security Rules 3, Database Schema). Also updated in "What We
   Are Building" and Permissions Summary.
3. AI System Prompt rewritten: broadened from Math/English-only authority to
   all 8 MVP subjects, and the exam register is now country-conditional
   (AQA/Edexcel/OCR style + "show your working" for England only; plain
   Ontario/Common Core phrasing + "show your work" for Canada/US) instead of
   forcing British phrasing everywhere. Also added an explicit science-depth
   rule: standalone Biology/Chemistry/Physics get full Triple-award depth
   (including Physics' Space topic); "Combined Science" gets the lighter
   Trilogy depth (Earth/atmosphere chemistry included, Space excluded
   entirely). Verified against the actual AQA GCSE Combined Science: Trilogy
   spec that Space physics is genuinely Triple-only and Earth/atmosphere
   chemistry is genuinely already in Combined Science - this is a real
   curriculum-accuracy rule, not a guess. The Subject Catalogue's existing 4
   science entries (Biology, Chemistry, Physics, Combined Science) already
   correctly represent both the Triple and Combined pathways - no catalog
   change was needed, just this generation-depth rule.
4. difficulty_overall (foundation/standard/higher) kept as-is in the schema -
   confirmed it is not currently displayed anywhere in the PDF/UI spec, so
   the UK-tiering-language concern doesn't apply yet. Left a note at the
   schema field: if a future feature ever surfaces this value to a reader,
   only show "Foundation"/"Higher" wording on England worksheets.

Also: Next.js 16 used instead of 14. Tailwind v4 CSS config, no
tailwind.config.ts. Next.js 16 renamed middleware.ts to proxy.ts (function
name "proxy" not "middleware") - a real framework breaking change, so the
protected-route file lives at src/proxy.ts. next.config.ts sets turbopack.root
to silence a workspace-root warning from an unrelated package-lock.json in the
user's home directory. Supabase project ref is xfzyuwlgejudgotfdrcq (the
project URL the user initially gave did not match its own keys - verify this
is still correct if auth calls ever fail with an invalid URL error).

browser-pool.ts required two forced deviations from the CLAUDE.md snippet to
compile against the actually-installed versions (@sparticuz/chromium 149.0.0,
puppeteer-core 25.7.0): chromium.defaultViewport and chromium.headless no
longer exist on the Chromium class (only .args and .executablePath() remain) -
dropped both, passing headless: true directly. page.setContent()'s type no
longer accepts waitUntil: 'networkidle0' (only page.goto() does now) -
switched to waitUntil: 'load'. Also added a dev-only fallback (approved by
user): @sparticuz/chromium ships a Linux-only binary and cannot launch on a
Windows/macOS dev machine, so when process.env.VERCEL and
process.env.AWS_LAMBDA_FUNCTION_NAME are both unset, getBrowser() launches a
locally installed Chrome/Edge instead (auto-detected from common install
paths, or process.env.CHROME_PATH override). The @sparticuz/chromium path for
serverless deploys is untouched and spec-accurate. Verified working locally
by generating a real PDF via Chrome.

User's Supabase DB password (in SUPABASE_POOLER_URL / SUPABASE_DIRECT_URL in
.env.local) contains a literal "@" character and closely resembles a
password reused from another service (Mailchimp). Verified live with a real
pg connection via the pooler - it authenticated successfully, so the "@" is
not a problem (standard connection-string parsers split on the last "@").
No reset needed on that account. (SUPABASE_DIRECT_URL separately times out
from this network - db.<ref>.supabase.co resolves AAAA-only, no A record,
so it is IPv6-only and unreachable here. Not a password issue. Not urgent:
nothing in the built code uses a raw Postgres connection - all app code goes
through supabase-js/PostgREST. Only mattered this session because Claude used
a temporary local `pg` dependency, install-then-uninstall each time, to apply
three live DB fixes directly instead of round-tripping SQL through the user.)

Three real bugs found and fixed live against the production Supabase project
(not just in the docs), all confirmed with a live test before and after:

1. check_and_log_generation used "SELECT COUNT(*) ... FOR UPDATE", which
   Postgres rejects (FOR UPDATE cannot combine with an aggregate) - confirmed
   by calling the function directly (Postgres error 0A000). Fixed with a
   per-user pg_advisory_xact_lock instead, which gives the same atomicity
   guarantee (this fix is separate from and predates the monthly-reset
   change in Decisions above - both are now in the same function).
2. The worksheets_public RLS policy (`USING (digital_code IS NOT NULL)`) was
   a real data exposure, not a scoped one: RLS filters rows by a stored
   predicate, not by what the caller's own WHERE clause claims to look for,
   so any anonymous request with the public anon key and NO filter returned
   EVERY worksheet with a digital_code - including mark_scheme_json.
   Confirmed live (inserted a test worksheet as service_role, read it back
   with the anon key and no filter or known code, got the full row back
   including the mark scheme). Fixed by dropping that policy entirely and
   adding the submissions_owner policy that was missing outright (RLS was
   enabled on submissions with zero policies, which would have silently
   blocked the tutor marking dashboard from reading its own data - deny-all
   is the Postgres default with RLS on and no matching policy, no error, just
   empty results). See Security Rules section 1 and the Database Schema RLS
   block for the corrected policies. supabase/fix-rls-worksheets-public.sql
   has the standalone fix if it needs to be re-applied anywhere else.
3. check_and_log_generation counted usage_log all-time instead of resetting
   monthly - see Decisions item 2 above. supabase/fix-free-tier-monthly.sql
   has the standalone fix if it needs to be re-applied anywhere else.

Verified against the current model catalog: claude-haiku-4-5 and
claude-sonnet-4-6 (both used in this file) are valid, active model ID
strings as of this session - no change needed there. (Initially suspected
these might be stale/wrong; checked before saying so.)

User asked to have npm run dev started proactively whenever there's UI
progress worth checking - they review visually in their own browser rather
than being shown screenshots. This instruction now also lives at the top of
CLAUDE.md (see the note right after "Ask before deviating"), so it should
always be seen even if this status section gets truncated in a summary.

---

SESSION UPDATE (following the one above):
Completed: Verified Phase 2 Step 9 was actually already built (found fully
implemented on disk but uncommitted, and not reflected in this status section
- almost certainly a prior session that was cut off before it could update
this file and commit, per the dropped-session protocol above). Reviewed the
implementation end to end against every relevant spec section (AI Output JSON
Schema, Security Rules, Performance Rules, Routing Structure) and fixed two
real issues found during that review, both applied directly to the code, not
just noted:
1. generateWorksheet.ts's MAX_TOKENS was 8000 - tight enough that a 10-question
   worksheet with diagram_specs and full mark schemes could legitimately
   truncate mid-response, which then looks identical to invalid JSON and
   burns the one retry for no real reason. Raised to 16000, still well under
   the non-streaming SDK timeout threshold.
2. The worksheets insert in src/app/api/generate/route.ts generated
   digital_code once with no collision handling against the column's UNIQUE
   constraint. Rare (8 random bytes) but on a collision it would burn the
   Claude API call and the free-tier usage_log credit for zero output. Added
   a 3-attempt retry loop that only retries on Postgres unique-violation
   (23505), regenerating the code each attempt.
Next: Phase 2 Step 10 - PDF HTML template for the worksheet, per the "The PDF"
section spec (header/badges/alignment note, section dividers, diagrams,
working lines, QR code, footer).
Decisions: none - both fixes above are corrections to already-approved Step 9
work, not new deviations from the spec.

---

SESSION UPDATE (following the one above):
Completed: Phase 2 Step 10 - worksheet PDF HTML template, built at
src/lib/pdf/worksheet-template.ts (renderWorksheetHtml()). Verified for real:
rendered a full sample worksheet through browser-pool.ts's generatePdf() via
an actual Next.js route (not a standalone script), got back a genuine 4-page
PDF, confirmed the header appears once (page 1 only), the footer repeats
correctly on all 4 pages ("Forma" / "N of 4"), and the QR block lands on the
last page. Also rendered a screenshot and visually confirmed badges, section
dividers (Warm-up gold / Challenge green), MathJax fraction rendering,
multi-part indentation with per-part marks and working lines, and three
diagram types (number line, bar chart, right-angle triangle, table) all
render in the correct brand colours. tsc and eslint clean.

browser-pool.ts's generatePdf() gained an optional third parameter,
{ headerTemplate?, footerTemplate? } - backward compatible, defaults to the
prior plain-content-only behaviour when omitted. This was necessary because
the footer's "N of M" page count can only come from Puppeteer's own
page.pdf() header/footer mechanism (which paginates internally), not from
anything renderable inside the page's own HTML flow.

Two known deviations, both judgement calls rather than spec violations,
neither blocking:
1. QR code placement. Spec says "bottom right corner, last page only."
   Puppeteer's header/footer templates apply uniformly to every page with no
   way to conditionally suppress based on comparing pageNumber/totalPages
   (total isn't known until Chrome finishes paginating), so true corner-
   pinning isn't achievable through that mechanism. The QR block is instead
   the last thing in the document's HTML flow, right-aligned - it lands on
   the last page for every worksheet length this product generates, just not
   pixel-anchored to the physical corner. A real fix would mean a two-pass
   render or post-processing the PDF with a library like pdf-lib to stamp it
   onto the actual last page - not done, flagging for a future pass if exact
   corner placement turns out to matter.
2. Footer font. Puppeteer renders header/footer templates in an isolated
   context that can't see the main document's Google Fonts <link>, so the
   footer ("Forma" / page number) falls back to Arial/Helvetica instead of
   Inter. Colours, size (10px), and layout are correct - just not the exact
   webfont, on one 10px line per page. Fixable by embedding the font as a
   base64 @font-face inside the footer template if it turns out to matter.

Also found, not fixed (belongs to a different file's scope): DIAGRAM_TYPES in
src/lib/ai/schema.ts doesn't include 'pie_chart' even though drawPieChart
exists and is exported from the diagram library - the AI can never actually
request one via diagram_spec. The template wires a pie_chart case into its
renderer anyway for parity, but the schema enum itself wasn't touched.

Next: Phase 2 Step 11 - PDF HTML template for the mark scheme.
Decisions: none - the two deviations above are documented workarounds for a
genuine Puppeteer limitation (header/footer template isolation), not
approved spec changes. Revisit if exact QR corner placement or the footer
webfont turns out to matter for the "how did they do that" bar.

---

SESSION UPDATE (following the one above):
Completed: Phase 2 Step 11 - mark scheme PDF HTML template, built at
src/lib/pdf/mark-scheme-template.ts (renderMarkSchemeHtml()), consuming the
markSchemeJson shape from splitMarkScheme.ts rather than questionsJson (no
diagram_spec or working_lines in that data, so this template renders text
only - no diagrams, no QR code, per spec). Shares FONT_LINKS, MATHJAX_SCRIPTS,
escapeHtml, formatDate, and buildFooterTemplate with worksheet-template.ts
(those four were exported, zero logic changed - confirmed the worksheet's
own rendered output is byte-identical before and after). splitMarkScheme.ts
got one additive line (question.type now carried into markSchemeJson) so the
mark scheme can reproduce the same Warm-up/Challenge section dividers as the
worksheet.

Verified for real: rendered a full 10-question mark scheme through
generatePdf() via an actual Next.js route, got back a valid 3-page PDF, and
screenshotted it to check colours and layout - which caught a real bug
before it shipped: single-part questions were showing their mark allocation
twice (once at the question level, redundantly again on the answer line).
Fixed so the per-part heading only renders on multi-part questions; re-
verified with another screenshot after the fix. Confirmed: green-tinted
(#E8F2ED) answer boxes with M1/A1/Answer/Allow/Common error, "Mark Scheme"
suffix after the student name, same header/badges/dividers as the
worksheet, no QR block. tsc and eslint clean (checked independently, not
just taken on the implementing session's word).

One addition beyond the literal spec text: an "Answer:" line was added
between A1 and Allow. The MARK SCHEME PDF section's format list only shows
M1/A1/Allow/Common error, but the schema's `answer` field (the actual final
answer, distinct from A1's accuracy-mark description) is real populated data
- dropping it would waste information a tutor grading papers needs. Not a
spec violation, just broader than the literal four-line list.

Next: Phase 2 Step 12 - Generation UI. This is the first visible step -
everything in Phase 2 so far (browser pool, diagram library, generation
endpoint, both PDF templates) has been backend-only, which is why nothing
has appeared in the browser during this stretch of the build.
Decisions: none.

---

SESSION UPDATE (following the one above):
Decision (user-approved before starting): /login, /signup, and student
profile create/list are referenced in the Routing Structure and Onboarding
Flows sections but were never scheduled as numbered Build Phase steps -
without them, Phase 2 Step 12's Generation UI would have nothing to select
a student from and no way to reach it past proxy.ts's auth check. Flagged
this to the user and got explicit approval to build them first, ahead of
Step 12 itself. Same reasoning applies to /api/pdf next - Step 12's
[Download A4]/[Download Letter] buttons need a route that doesn't exist yet
either, and Steps 10-11 only built the render functions, not the endpoint
that serves them.

Completed: /login, /signup, and student profile create/list at
/dashboard/students, plus a minimal protected dashboard shell
(src/app/dashboard/layout.tsx - wordmark, nav, sign-out). Files:
src/app/login/{page,LoginForm}.tsx, src/app/signup/page.tsx,
src/app/privacy/page.tsx (stub, grounded in the real 24-month deletion text
from Legal Requirements rather than boilerplate), src/app/dashboard/{layout,page}.tsx,
src/app/dashboard/students/{page,StudentForm,actions}.tsx,
src/lib/supabase/ensureUserProfile.ts, src/lib/ui/formStyles.ts (shared
Tailwind class constants for the spec'd input/button/card values).

Judgment call worth knowing: signUp() doesn't guarantee an active session -
this Supabase project has email confirmation enabled (confirmed live, hit
Supabase's own email rate limit during testing), so the `users` row can't
always be inserted at signup time (RLS needs auth.uid() = id, no
authenticated caller exists yet if confirmation is pending). role/region
ride on signUp's user_metadata instead, and ensureUserProfile() creates the
row lazily on first dashboard visit - one code path correctly covers both
the instant-session and confirm-then-log-in cases. Region -> paper_size
mapping (used to satisfy Database Schema's users.paper_size and the PDF
section's A4/Letter requirement) isn't specified anywhere in CLAUDE.md as an
exact rule, so a simple england/canada_ontario -> 'a4', united_states ->
'letter' default was chosen - reasonable, not literal spec text.

curriculum_level on the student form follows the Country and Curriculum
Catalogue's own per-country labels (KS2/KS3/GCSE/A-Level;
Ontario Elementary/Secondary; US Common Core/AP/SAT/ACT) rather than the
narrower CurriculumLevel type in src/lib/ai/schema.ts, which only scopes the
AI worksheet's own output field and has no AP/SAT/ACT.
student_profiles.curriculum_level is unconstrained TEXT, so this is safe.

Verified for real against the live Supabase project (not just compiled):
signup -> users row created with correct role/region/paper_size -> student
created via the real form -> row confirmed with correct owner_id and
subjects array -> sign-out clears the session and re-protects the route ->
log back in works. All test data deleted afterward. tsc and eslint clean
(checked independently of the implementing session, not just taken on its
word) across the whole project, no stray test files or package.json changes
left behind.

Next: Phase 2 Step 12 proper - the Generation UI itself, plus the /api/pdf
route its download buttons need.
Decisions: covered above.

---

SESSION UPDATE (following the one above):
Completed: Phase 2 Step 12 - Generation UI and /api/pdf, finished and
verified for real. Found the Generation UI and /api/pdf route already fully
built and uncommitted on disk at session start (src/app/dashboard/generate/,
src/app/api/pdf/route.ts, verify-generation-ui.mjs) - almost certainly a
prior session cut off before it could verify, commit, and update this file,
per the dropped-session protocol at the top of CLAUDE.md. Reviewed the code
against the Generation UI spec (input, prompt helper, topic picker, loading
state with Cancel, debounced difficulty buttons, A4/Letter downloads with
the correct filename format) and it matched; started `npm run dev` and ran
the verify script (which was itself already written for exactly this) to
confirm for real rather than take the prior session's work on faith. That
surfaced one genuine, non-obvious bug, which is the substance of this
session:

/api/generate was failing every call with 500 once a real Anthropic credit
balance was in place (it had first been masked by a zero credit balance,
which the user fixed mid-session). The actual cause: generateWorksheet.ts's
output_config.format.schema (src/lib/ai/schema.ts) had
diagram_spec.params typed as a bare `{ type: 'object' }` with no
`properties` - Claude's Structured Outputs rejected this live
("'additionalProperties' must be explicitly set to false"). Fixed in three
escalating attempts, each one rejected by the API for a different reason,
until landing on the one that actually works:
1. A 7-way anyOf branch per DIAGRAM_TYPES member (one params shape per
   diagram type, each additionalProperties:false) - schema-valid, but
   repeated inside every question part's diagram_spec across 10 questions,
   it compiled to a grammar the API refused as too large ("Simplify your
   tool schemas or reduce the number of strict tools").
2. A single flat params object superset-ing every diagram type's fields,
   all nullable so any one diagram only fills in what it needs - avoided
   the grammar-size problem, but hit a separate, harder cap: Structured
   Outputs allows at most 16 total nullable/union-typed parameters across
   the whole schema, and this object alone needed about 25.
3. The one that shipped: diagram_spec.params is now `{ type: 'string' }` -
   a JSON-encoded string, opaque to the schema, so it contributes zero
   object nesting and zero unions. The AI writes an actual JSON object as
   text into it. Since the schema no longer enforces field names per
   diagram type, WORKSHEET_SYSTEM_PROMPT (src/lib/ai/systemPrompt.ts, kept
   in sync with the AI System Prompt section in CLAUDE.md) now documents the
   exact field names for all 7 diagram types directly in the prompt text
   instead. worksheet-template.ts's renderDiagramSvg does the JSON.parse at
   render time, inside the try/catch it already had for malformed
   diagram_spec, so a bad string degrades to "no diagram" exactly like a
   malformed object always did - no new failure mode. DiagramSpec.params's
   TS type changed from Record<string, unknown> to string to match.

Confirmed the fix directly against the real API (not just via the app):
wrote a throwaway script calling generateWorksheet() standalone, watched it
fail with each of the three schema shapes above in turn with the exact
error text quoted, then succeed once params became a string - a real
10-question worksheet came back with a valid diagram_spec (bar_chart) whose
params was genuine parseable JSON text.

Also found and fixed a bug in verify-generation-ui.mjs itself (not app
code): downloadAndVerify()'s button lookup always took the first DOM match
for button text like "Download A4", which is correct when checking the
worksheet section but wrong when reused for the mark scheme section - both
sections render a same-labelled button, worksheet's first in DOM order, so
the mark scheme check was silently re-clicking the worksheet's button and
failing its own assertions. Added a buttonIndex parameter (0 for worksheet,
1 for mark scheme), matching the disambiguation pattern the script already
used for the Letter button just below it.

Verified for real, end to end, against the live Supabase project and the
real Claude API (not just compiled) via the corrected verify script: signup
-> login -> student picker populated -> prompt hint text -> Generate calls
the real API and returns a valid 10-question worksheet -> loading state
cycles its messages -> success state shows subject/topic/alignment_note ->
difficulty buttons debounce for 2s and persist difficulty_feedback to the
database -> worksheet PDF downloads in both A4 and Letter (real PDF magic
bytes, correct
[StudentFirstName]-[Subject]-[DDMMMYYYY].pdf filename, e.g.
Naeto-Mathematics-17Aug2026.pdf) all passed cleanly in one full run.
tsc and eslint clean.

Not independently reverified in the same clean run (session ended before a
fully green pass after the button-selector fix, for reasons below): mark
scheme PDF download content, the 403 mark-scheme-entitlement gate, and the
404 cross-tenant isolation check. These are pre-existing /api/pdf logic
from the prior session that this session read in full and found correct
against spec (Permissions Summary's tutor-plus-pro mark scheme gate; RLS-
backed ownership check documented inline in the route) - not code this
session changed - so confidence is high, but flagging that the specific
assertions for those three didn't get a rerun with a passing log line
attached.

Real, separate finding, not a code bug: this Windows machine hit repeated,
genuine TLS-layer network failures against Supabase mid-session (OpenSSL
"SSL alert number 50 - decode error" surfacing as generic `TypeError: fetch
failed` through supabase-js), intermittently breaking login and DB inserts
made through the app's normal request path. Root-caused with a throwaway
script that signed in and inserted through the same anon-key/RLS-bound
client src/lib/supabase/server.ts uses (a service-role-client repro never
reproduced it - only the real client path did). This explains the
"Failed to store worksheet {}" lines seen in .next/dev/logs during this
session (the dev server's structured logger doesn't unwrap the nested
`.cause` chain on that error shape, hence the empty-looking {}) - the
route's existing generic 500 + "please try again" handling is actually the
correct response to it, not a gap. Not fixed because it isn't a code
problem to fix; noting it here in case it recurs and wastes another
session's time re-diagnosing it. The dev server also hit an unrelated
Turbopack crash once this session (child process exit 0xc0000142 while
transforming globals.css, mid-way through repeated hot-reloads) - resolved
by clearing .next and restarting, not a code issue either.

Next: Phase 2 Step 13 - the /s/[code] public digital worksheet page (no
auth, safe-column-only query per Security Rules 1 and the Routing
Structure section, mobile-responsive, answer fields, submit button). Before
building it, add the worksheets.expires_at column and enforce the 30-day
link expiry promised in User Challenges - the schema still has no column
for it (flagged, not yet fixed, in the Step 9 session above; still true).
Decisions: none beyond the diagram_spec.params schema-to-string change,
which is a Structured Outputs constraint discovered live, not a preference.

---

SESSION UPDATE (following the one above):
Opened by answering a user question: no, "student login" was never started -
checked git log and grep across CLAUDE.md/src and found nothing. The only
existing auth (/login, /signup) is tutor/parent account auth from the Step
12-adjacent session, unrelated. "Student portal login" is Phase 6 Step 36,
not due yet - nothing was half-finished there.

Completed: Phase 2 Step 13 - the /s/[code] public digital worksheet page,
the worksheets.expires_at column and 30-day link expiry enforcement, and
(by explicit user choice when asked, matching the established pattern of
flagging before deviating from a step's own numbered scope) a minimal
/api/submit built alongside it so the page's submit button is real rather
than a placeholder. Tier 1/2/3 marking logic stays untouched at Phase 3
Steps 16-19 - /api/submit only stores answers_json.

worksheets.expires_at: added live via ALTER TABLE (temporary local `pg`
dependency, install-then-uninstall, same pattern as the Step 9 session's
live DB fixes), DEFAULT (NOW() + INTERVAL '30 days'), evaluated per row at
INSERT time so every new worksheet gets its own created_at + 30 days.
supabase/add-worksheet-expiry.sql has the standalone fix; schema.sql and
its index list updated to match.

/s/[code] (src/app/s/[code]/page.tsx + StudentWorksheetForm.tsx): Server
Component queries via a new src/lib/supabase/admin.ts service-role client
(the first one in the project - Security Rules 1 requires it here and in
/api/submit, and no admin client existed yet). Selects id, digital_code,
subject, topic, alignment_note, expires_at, questions_json - not the
literal "year_level" CLAUDE.md's Routing Structure names, because that was
never its own worksheets column; it's read from questions_json.year_level
instead (spread in from the AI response by splitMarkScheme.ts). No student
name is fetched or shown - Security Rules 1's "select only" instruction is
followed literally, so the page greets nobody by name, just shows
subject/topic/badges/alignment note. Expired links (expires_at in the past)
render a plain "This link has expired - ask your tutor to resend it"
card instead of the worksheet, no retry button (nothing to retry). Unknown
codes hit Next's notFound(). Answers are freeform text per part (the AI
schema has no multiple-choice/numeric-typed question format to build
structured inputs around) posted as { digitalCode, answers } to /api/submit,
which re-looks-up the worksheet server-side by digitalCode (never trusts a
client-supplied worksheetId or student_id), re-checks expiry, validates
answer shapes/lengths, and inserts into submissions with student_id read
from its own server-side lookup - never sent to or received from the
browser.

Real security finding, fixed before it could matter: every diagram function
in src/lib/diagrams/ (coordinateGrid, triangle, barChart, pieChart,
numberLine, circle, table) interpolated label/text strings directly into
SVG markup with no escaping. This was already live in worksheet-template.ts
but only reached a Puppeteer-controlled PDF context; the student page now
renders the same SVG strings straight into a real visitor's browser via
dangerouslySetInnerHTML, which would have made an AI-generated diagram
label a genuine stored-XSS vector (a label containing markup would execute
in a real student's browser, not just get rasterised into a PDF). Fixed at
the source: new src/lib/diagrams/escapeSvgText.ts, applied at every point a
diagram function embeds a string as SVG text content, in the diagram
functions themselves - not in the callers - so both the PDF and the web
page are protected by construction, not by remembering to sanitise before
calling in.

Also extracted, while touching this code anyway, two dispatchers that had
independently drifted into two (renderDiagramSvg) and three
(sectionDividerLabel) copies of the same logic across worksheet-template.ts
and mark-scheme-template.ts: renderDiagramSvg -> new
src/lib/diagrams/renderDiagramSpec.ts (shared by the PDF template and the
student page - one definition of how a diagram_spec maps to a rendered
SVG, so the two surfaces can't silently disagree), sectionDividerLabel ->
new src/lib/worksheet/sectionDividerLabel.ts (generic over anything with a
`type` field, since the function never actually touched `.parts` - the
prior session's stated reason for keeping mark-scheme-template.ts's copy
duplicated, "the two documents' Question types don't share a compatible
parts shape," didn't actually apply to this function).

Verified for real, end to end, with a throwaway script (not just compiled):
generated a real worksheet via the Claude API, inserted it directly,
fetched /s/[code] over real HTTP and confirmed 200, "Q1", the subject
badge, the submit button, at least one inline <svg> diagram, and - the
security-relevant check - that mark scheme fields (M1, common_error) are
structurally absent from the response HTML; confirmed an unknown code
returns 404; POSTed a real submission to /api/submit and confirmed a
submissions row was created with the correct student_id and matching
answers_json; confirmed an unknown digitalCode on /api/submit returns 404;
backdated expires_at and confirmed the page shows the expired message with
no submit form and /api/submit returns 410. All checks passed. Also
screenshotted the live page (after two throwaway-script failures along the
way, both caused by this session's same recurring TLS network flake, not
app bugs - see below) and visually confirmed the header, badges, alignment
note, Warm-up/Challenge dividers, ten questions with mark allocations,
coordinate-grid diagrams rendering correctly (axes, gridlines, plotted
points, labels), answer textareas, and the Submit answers button all match
the Design System. tsc and eslint clean.

Same environmental TLS network flake as the previous session recurred
several times this session (Supabase auth/DB calls intermittently failing
with fetch errors) - not a code issue, already root-caused and documented
in the session above; not re-diagnosed, just worked around by retrying.

Next: Phase 3 Step 15 is effectively done (minimal submission handler now
exists) - next real work is Phase 3 Step 16, Tier 1 auto-marking on
submission (numerical/coordinates/true-false/multiple-choice, exact match
with 0.01 decimal tolerance). Note the AI Output JSON Schema currently has
no question-format field to distinguish these types from freeform text, so
Step 16 will likely need a schema/prompt addition before auto-marking has
anything reliable to key off - flagging now so it isn't a surprise mid-step.
Decisions: covered above (minimal /api/submit built alongside Step 13,
approved by the user when asked).

---

SESSION UPDATE (following the one above):
Opened by finding a dropped, uncommitted session in progress (per the
dropped-session protocol at the top of CLAUDE.md): vitest was already
installed (package.json's "test" script, vitest.config.ts pointed at
src/__tests__/**/*.test.ts per the Testing Strategy section) and
answer_format had already been added to QuestionPart, ANSWER_FORMATS, the
Structured Outputs schema, and WORKSHEET_SYSTEM_PROMPT's per-format
guidance to the AI - all uncommitted. That work was reviewed against spec
and found correct (matches the Marking Logic section's Tier 1 answer types
exactly), so it was kept and completed rather than redone.

Completed: Phase 3 Step 16 - Tier 1 auto-marking. New src/lib/marking/tier1.ts
exports markPart(answerFormat, correctAnswer, studentAnswer, marks), one pure
function with no I/O: numerical compares numeric value within the spec's 0.01
tolerance (falling back to a normalised exact-string match when either side
isn't parseable as a number, e.g. an answer written as a fraction like
"3/4" - a blank student answer is never treated as matching "0" here,
guarded explicitly since Number('') is 0 in JS); coordinates and
true_false/multiple_choice match after normalising whitespace and case, not
parsing, per the comment already written into the schema/prompt by the
dropped session; extended returns null so the caller knows to route it to
Tier 2 or Tier 3, neither of which exist yet. Wired into
src/app/api/submit/route.ts: for every question part the student answered,
markPart() runs and the per-part results (or null for extended parts) are
stored in the new auto_marks_json column data on the submissions insert.
score_percentage is deliberately still left NULL - Tier 2/3 don't exist, so
computing a score from only the auto-markable subset of a worksheet's marks
would misrepresent the student's real result on any worksheet with extended
questions (most English/Biology/Chemistry/Physics content). That aggregate
belongs to a later step once all three tiers can contribute to it.

13 unit tests added at src/__tests__/tier1.test.ts (numerical exact/within-
tolerance/just-outside-tolerance/negative/fraction-fallback/blank-answer,
coordinates whitespace-and-case normalisation, true_false and
multiple_choice case-insensitivity, extended returning null) - all passing.
This is the first test suite in the project; `npm run test` now does
something. tsc --noEmit and eslint both clean across the whole project,
including a pre-existing throwaway script (test-generate-logic.mts,
committed back in the Phase 2 Steps 7-9 session) that the answer_format
schema change had broken - fixed with a single `as const` rather than left
broken, since it's tracked in git and tsc --noEmit covers the whole project
by default.

Not done, and deliberately out of scope for this step: Tier 2 (AI-assisted
marking via claude-sonnet-4-6) and Tier 3 (tutor review queue) are Phase 3
Steps 17-19, untouched. The marking dashboard that would let a tutor
actually see auto_marks_json (Step 18) also doesn't exist yet, so there is
no UI surface for this session's work yet - it's reachable only via
/api/submit's response and the database row directly. Not verified with a
live end-to-end script against the real Supabase project this session
(unlike most prior sessions) - Tier 1 is pure logic with no external I/O of
its own, so unit tests are the correct verification per the Testing
Strategy section's own split ("Marking algorithm (all tiers)" is listed
under UNIT TESTS, not END-TO-END) and running a live script would mostly
be re-testing /api/submit's existing, already-verified insert path.

Next: Phase 3 Step 17, Tier 2 AI-assisted marking (claude-sonnet-4-6,
confidence gating, 5-second target). This will need a real prompt asking
the model to mark an "extended" part against its mark_scheme (M1/A1/allow/
common_error) and return {marks_awarded, reasoning, confidence} - low
confidence must be flagged for tutor review rather than auto-applied, per
the Marking Logic section. Step 18 (tutor marking dashboard) has no page or
route yet either and will be needed before a tutor can act on anything
Tier 2 or Tier 3 produce.
Decisions: none beyond completing the dropped session's already-approved
Step 16 scope.

---

SESSION UPDATE (following the one above):
Split this file out of CLAUDE.md. CLAUDE.md's Current Build Status section
had grown to roughly 650 lines of session-by-session history, re-read in
full at the start of every session regardless of relevance to the work at
hand - pure context overhead with no per-session benefit. All history above
this entry was moved here verbatim (only cross-references to "this file"
were reworded to "CLAUDE.md" where they meant the parent file). CLAUDE.md's
Current Build Status is now a 5-line snapshot (completed / next / open
risks) pointing here for detail. Nothing in the actual product changed.
Decisions: none - a documentation reorganisation, not a scope or plan
change. Per explicit user instruction, distribution/curriculum-coverage/AI-
accuracy-testing/unit-economics concerns raised in a prior conversation are
noted as the user's own responsibility going forward (they'll validate via
their own students and teacher contacts) and are out of scope to keep
raising during the build.

---

SESSION UPDATE (following the one above):
Completed: Phase 3 Step 17 - Tier 2 AI-assisted marking. New
src/lib/marking/tier2.ts exports markExtendedPart(input, signal), calling
claude-sonnet-4-6 (Tech Stack: "claude-sonnet-4-6 for AI-assisted marking
only") with Structured Outputs to return {marks_awarded, reasoning,
confidence}. System prompt asks the model to apply M1/A1 the way a human
examiner would (method mark for correct approach even if the final answer
is wrong, accuracy mark only for a correct or Allow-listed final answer),
and to set confidence "low" - never auto-applied, always needs a tutor,
per the Marking Logic section - whenever the answer is blank, off-topic,
illegible, or genuinely ambiguous. marks_awarded is clamped to [0, marks]
defensively in code rather than trusted verbatim from the model.

Wired into src/app/api/submit/route.ts: for every "extended" part the
student actually answered (blank extended parts are skipped - nothing to
mark), a Tier 2 call runs. All of a submission's Tier 2 calls run in
parallel under one shared AbortController with a 15-second timeout
(Performance Rule 10: "Marking AI: 15 seconds maximum"), via
Promise.allSettled so one slow or failed call can't take down the others
or the submission itself - a rejected or timed-out call just leaves that
part's entry null in the new ai_suggested_marks_json column data, same
"needs Tier 3 review" meaning as an unanswered part. score_percentage
stays NULL still: Step 16's reasoning holds unchanged now that Tier 2
exists, since a low-confidence suggestion must never be auto-applied, so
no aggregate score can be correct until Tier 3 (tutor review) can resolve
those - that's Phase 3 Step 19, not this one.

6 unit tests added at src/__tests__/tier2.test.ts, mocking the Anthropic
SDK (vi.mock with vi.hoisted, constructor mock needs a real function/class
expression, not an arrow function - vitest logs a warning and the `new`
call fails otherwise): confirms needs_review is true only for "low"
confidence, and confirms the [0, marks] clamp on both ends. tsc --noEmit
and eslint clean across the whole project. Also ran two live calls against
the real Anthropic API (not just the mock) via a throwaway script: a
correct chemistry-explanation answer returned marks_awarded 3, confidence
"high"; a nonsense answer ("idk maybe science stuff") returned
marks_awarded 0, confidence "high" (not "low" - confirms the model reads
"low confidence" as genuine ambiguity, not just "clearly wrong", which is
the intended calibration). The first live attempt at the nonsense-answer
case hit a 15-second AbortController timeout that a retry with a longer
timeout did not reproduce (the retry completed in under 3 seconds) - same
category as this dev machine's previously-documented intermittent
TLS/fetch flakiness, not a code bug, and not something a production Vercel
environment shares.

Next: Phase 3 Step 18, the tutor marking dashboard
(/dashboard/marking per the Routing Structure section - the route doesn't
exist yet). Needs to read submissions and display answers_json alongside
auto_marks_json and ai_suggested_marks_json per part, let a tutor see which
parts are needs_review: true, and let them award/override a final mark
(tutor_marks_json) - which is also the first point where score_percentage
can finally be computed correctly, once a tutor has resolved every
extended part between Tier 2's suggestion and their own judgement. Step 19
(the review queue itself, with a comment field) is closely related and may
end up being built alongside Step 18 rather than strictly after it -
flagging now rather than assuming a hard boundary between them.
Decisions: none beyond completing Step 17 as scoped.
