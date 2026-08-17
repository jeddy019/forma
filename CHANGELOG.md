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

---

SESSION UPDATE (following the one above):
Opened by finding a real, live bug before writing any dashboard code: split
MarkScheme.ts (src/lib/ai/splitMarkScheme.ts) predates Phase 3 Step 16's
answer_format addition to the schema and was never updated to carry it -
questions_json never had it (by design, students must never see it) but
mark_scheme_json didn't either (an oversight), so answer_format ended up
undefined in both stored JSON blobs. Concretely, that meant Tier 1's switch
on answer_format matched no case on every real submission (auto_marks_json
was silently all null, not because parts were correctly identified as
unmarkable but because the field determining that was simply missing), and
Tier 2's `=== 'extended'` check was always false, so it never ran at all.
Both Step 16 and Step 17's sessions verified with unit tests that fed
markPart()/markExtendedPart() clean hand-crafted input directly and never
caught this, because the bug was entirely in how route.ts wired real
worksheet data into those functions, not in the functions themselves - a
gap unit tests can't see and a live end-to-end check would have. Fixed by
adding answer_format to the parts markSchemeJson keeps (the correct home
for it: only /api/submit's service-role code reads it, mark_scheme_json is
already the "never reaches a student" bucket, per Security Rules 1), and by
changing /api/submit/route.ts to select mark_scheme_json alongside
questions_json and merge them by question/part index (same order and count,
both derived from the same generation call) - questions_json still supplies
part text, mark_scheme_json now supplies answer/answer_format/mark_scheme.
Confirmed the fix with a real generated worksheet posted through the real
/api/submit route (not the mock-based unit tests): auto_marks_json came
back with real matched:true/marks_awarded results across all 10 questions,
and a Tier 2 call fired and returned a real AI suggestion for the one
extended part - neither had ever actually happened on a real submission
before this fix.

Completed: Phase 3 Step 18 - the tutor marking dashboard, and effectively
Step 19 alongside it (see the Decision below). New routes:
/dashboard/marking (list, paginated at 20 per Performance Rule 3) and
/dashboard/marking/[id] (detail). Both gated the same way as mark scheme
PDFs (role === 'tutor' && plan === 'pro', Permissions Summary) - an upsell
message instead of the dashboard for anyone else. The list shows student,
subject/topic, submitted date, and a Reviewed/Needs review badge (reviewed
= tutor_marks_json is not null) with the score once reviewed. The detail
page (src/app/dashboard/marking/[id]/page.tsx) merges questions_json and
mark_scheme_json by index server-side into one MergedQuestion[] shape and
hands it to a client MarkingForm: Tier 1 parts render read-only (student
answer, correct answer, matched/marks - nothing for a tutor to decide, it's
an exact match); extended parts render the mark scheme (M1/A1/Allow/Common
error - safe to show a tutor, unlike a student, per Security Rules 1) plus
the Tier 2 AI suggestion (confidence-coloured badge + reasoning) as a
starting point, in an editable marks input the tutor can accept as-is or
override.

Decision (flagged in the previous session's Next note, not re-confirmed
mid-session since it was already surfaced in advance): built Step 19 (the
tutor review queue with a comment field) together with Step 18 rather than
after it. A marking dashboard a tutor can only look at, with no way to
actually award a mark, isn't a real feature per Principle 1 - the natural
unit of work is "see a submission and finish marking it," which is what
the single save action does: src/app/dashboard/marking/[id]/actions.ts's
saveMarkingAction re-fetches the submission fresh from the DB (never trusts
anything about auto_marks_json/mark scheme echoed back from the client),
takes Tier 1's marks_awarded verbatim for auto-marked parts, takes the
tutor's number for every extended part (0 for one the student left blank,
clamped to [0, marks] otherwise), sums both against the worksheet's total
available marks, and writes tutor_marks_json + tutor_feedback (optional,
2000 char limit) + score_percentage in one update. This is also the first
point score_percentage is ever computed and stored - Steps 16 and 17 both
left it NULL by design, exactly until a human could resolve every extended
part, which is now possible.

Verified for real, end to end, not just unit tests or a mock: a throwaway
Puppeteer script (browser-pool.ts's local-Chrome fallback pattern, not the
mock from tier2.test.ts) created a real confirmed tutor-pro test account
via the admin API (sidestepping this project's email-confirmation
requirement), generated a real worksheet via the Claude API, force-set one
part to answer_format "extended" (so the run deterministically exercises
the Tier 2/tutor-review path rather than depending on the AI happening to
choose "extended" for something), submitted real answers through the real
/api/submit route, then drove an actual logged-in browser session through
/login -> /dashboard/marking (confirmed student name, subject, "Needs
review") -> the detail page (confirmed Q1, the student's submitted answer
text, the mark scheme's M1 line, the Tier 1 "Correct" indicator, and the
Tier 2 "AI:" suggestion badge all render) -> clicked "Save marking" ->
confirmed the "Marking saved." message and the list page's badge flipping
to "Reviewed" with a score. Read the database row directly afterward and
confirmed tutor_marks_json and score_percentage (100%, correct for the
all-correct answers submitted) matched what the UI showed. All test data
(auth user, student, worksheet, submission) deleted afterward.

Two real snags hit and fixed while writing that verification script, both
about Puppeteer/Next.js interaction rather than app bugs, worth recording
so a future session doesn't re-diagnose them: (1) LoginForm.tsx and
MarkingForm's save button both resolve via a client-side transition
(router.push+refresh, and a Server Action respectively), not a full
document navigation, so page.waitForNavigation() hangs indefinitely on
both - fixed by polling window.location.pathname / the DOM text instead;
(2) the dashboard header's "Sign out" button is also button[type=submit]
and comes first in DOM order, so a plain button[type=submit] selector
clicked "Sign out" instead of "Save marking" and silently logged the test
session out - fixed by selecting on visible text instead of tag/type alone.

Next: Phase 3 Steps 15-19 are now all done - Phase 3 (Marking) is complete.
Next real work is Phase 4 (Automation and Email), starting with Step 20:
Resend integration and the 8 React Email templates in src/emails/, with
unsubscribe headers on emails 3/4/5 per the Legal Requirements section.
Decisions: covered above (Step 19 folded into Step 18).

---

SESSION UPDATE (following the one above):
Opened with a real, sizeable scope addition from the user, delivered across
two messages that directly contradicted each other on one point - caught
before acting on either side rather than guessing: the user's own reply
said both "do NOT add an email column to student_profiles at all... Do not
add student email anywhere" (with GDPR/COPPA reasoning) and, further down
the same message under a "Student Accounts - Revised Decision" heading,
"Add student_profiles.email as optional... Student login is optional but
supported." Asked directly which was current rather than picking one -
confirmed: the Revised Decision stands (optional email, optional login,
tutor/parent as data controller and Forma as data processor - see
CLAUDE.md's new Student Accounts and Data Processor Status subsection under
Legal Requirements).

Completed, before any Step 20 code: folded a large Kumon-methodology
addition into the plan documents (CLAUDE.md), applied the resulting schema
changes live, and extended the one already-built feature the schema change
touches (the student profile form) - all as documentation/schema work, not
as an attempt to build the Kumon mastery logic itself in this session (see
Decision below for why that's deliberately deferred).
- New "Kumon Methodology and Question Quality" section in CLAUDE.md
  (mastery-before-progression at an 85%-across-two-worksheets threshold,
  per-sub-skill tracking, speed awareness, daily 5-question practice mode,
  return-to-fundamentals on sub-50% scores, a human-verified question bank)
  - placed after Adaptive Difficulty with a forward-note that Phase 7
  eventually supersedes that section's single current_difficulty dial with
  per-sub-skill mastery, not yet.
- New "PHASE 7 - Kumon Mastery Model" in Build Phases, Steps 37-42, one
  step per principle above - deliberately its own phase after Phase 6
  rather than squeezed into whichever phase happened to be active, since
  this is genuinely multi-session work (sub-skill AI schema/prompt changes,
  a mastery algorithm, a prerequisite-sub-skill map, a whole new generation
  mode, and educator-facing verification tooling are each real features).
  Two open questions flagged inline rather than guessed at: how "time
  spent" is actually captured for speed awareness (Step 39), and what
  mechanism backs the sub-skill prerequisite map for return-to-fundamentals
  (Step 41) - both explicitly deferred to when those steps are actually
  built, not decided now.
- New "Student Accounts and Data Processor Status" subsection under Legal
  Requirements, and student_profiles.email/skill_map added to Database
  Schema, both matching the confirmed Revised Decision.
- Fixed a real, separate drift while touching the Database Schema section
  anyway: CLAUDE.md's embedded copy of the worksheets table never got
  expires_at added when Phase 2 Step 13 added it live and updated
  schema.sql - only schema.sql was fixed at the time, this file's own copy
  silently went stale. Caught by diffing against the real schema.sql before
  editing rather than trusting this file's own text.
- Onboarding Flows and Permissions Summary updated to match (email field
  in the student-profile form fields list; STUDENT permissions line no
  longer says "no account required" outright).

Schema changes applied live against the production Supabase project (same
temporary-local-`pg`-dependency, install-then-uninstall pattern as every
previous live DB fix in this file) and confirmed via information_schema
queries immediately after: student_profiles.email (TEXT), student_profiles.
skill_map (JSONB, default '{}'), and a new question_bank table (RLS
enabled, zero policies - not user-owned, same service-role-only pattern as
usage_log/webhook_events, since educators write/verify these and only the
generation pipeline reads them). supabase/add-student-email-skillmap-
questionbank.sql has the standalone fix; schema.sql updated to match.

Extended the already-built student profile form (src/app/dashboard/
students/{StudentForm,actions}.tsx) with the new optional email field -
simple format validation server-side (not full RFC 5322, just enough to
catch obvious typos before Resend's own delivery attempt would), 200 char
max. Did not add anything to the students list page's display or build
student login itself - login is still Phase 6 Step 36, unbuilt.

Completed: Phase 4 Step 20 - Resend integration and all 8 React Email
templates. src/emails/components/EmailLayout.tsx is the shared wrapper (one
definition of the Forma email chrome so the 8 templates can't drift from
each other or from the Design System) - real constraint handled correctly
rather than assumed away: email clients strip <link> tags, so the Design
System's actual web fonts can't be relied on the way the PDF's <link> tags
can. Used React Email's <Font> component (declares intent + a real
web-safe fallback stack) rather than just hoping Playfair Display/Inter
load. React Email's fallbackFontFamily prop only accepts a fixed keyword
enum (not an arbitrary CSS font-stack string) - caught by tsc, fixed by
keeping two versions of each fallback (the constrained array for <Font>,
a full CSS string for inline styles).

All 8 templates built (src/emails/*.tsx) with the props each actually has
available - notably, users has no "name" column anywhere in the schema
(email/role/plan only), so every template greets by role or by the
student's name, never a tutor/parent name that doesn't exist. Only emails
3, 4, and 5 (WeeklyDelivery, MondayParentSummary, TutorParentReport) pass
showUnsubscribeFooterLine and get the List-Unsubscribe header, per Legal
Requirements. That header is a mailto: link, not a one-click HTTP
unsubscribe endpoint - deliberate, not a shortcut: CLAUDE.md's spec here
just says "Use Resend's built-in support" and "Include the List-Unsubscribe
header," and there is no per-recipient subscription-preference table
anywhere in the schema to back a stateful one-click flow. A mailto: link is
a genuinely compliant mechanism on its own (CAN-SPAM/CASL/GDPR require *a*
working unsubscribe path, not specifically a one-click HTTP one) -
documented as a real design choice in EmailLayout.tsx's own comment, to
revisit only if a real preference centre is ever built.

src/lib/email/resend.ts (client + EMAIL_FROM constant) and src/lib/email/
send.tsx (one typed wrapper function per template, e.g.
sendWorksheetReadyEmail()) - every wrapper returns a boolean and never
throws, by design: a failed email send must never break the flow that
triggered it (a failed welcome email must not fail signup, same principle
already established for Tier 2 marking calls in /api/submit). EMAIL 2/3's
recipient (student directly vs. the account owner) is decided by the
caller, not the template - the template only needs to know
sentToStudentDirectly for its wording, matching the confirmed Student
Accounts decision.

Wired up the one trigger point that already exists: EMAIL 1 (Welcome) now
actually sends on signup, via a new src/app/signup/actions.ts server action
(signup/page.tsx is 'use client', RESEND_API_KEY is server-only per
Security Rules 5, same reason createStudentAction/saveMarkingAction are
server actions). Fired for both the instant-session and
confirm-later-then-log-in signup paths (CLAUDE.md says "sent immediately on
signup," not "once confirmed"), never awaited in a way that could block or
fail the redirect. EMAILS 2-8 are not wired into any trigger yet -
deliberately: 2's trigger (manual generation) belongs to whichever future
change touches /api/generate, 3's trigger is the Step 22 cron job, 4 is
Step 24, 5 is Step 25, 6/7/8 are Phase 5's webhook handler - none of those
exist yet, so there is nothing real to wire into. Building send.tsx now and
wiring each call in when its actual trigger gets built (rather than wiring
early against a placeholder) avoids a half-connected email firing at the
wrong time later.

Verified for real, to the extent possible: RESEND_API_KEY is empty in
.env.local (confirmed by grep before claiming otherwise), so no live send
could be tested this session - flagging plainly rather than skipping past
it. What was verified: all 8 templates render to valid HTML via
@react-email/render (a throwaway script rendered each with realistic props
and checked for a real <html> document, all 8 passed), and the
unsubscribe-footer-link logic was checked directly against the rendered
HTML - present on WeeklyDelivery/MondayParentSummary/TutorParentReport,
absent on Welcome, matching the emails-3/4/5-only rule exactly. tsc --noEmit
and eslint clean across the whole project. Signup's new call site compiles
and type-checks against the real sendWelcomeEmail() signature, but was not
exercised through a live signup + inbox check this session, since there is
no real API key to send through yet.

Next: Phase 4 Step 21 - Schedule UI (all fields from the schedules table,
editable at any time, pause with a date picker) - the first user-facing
page in Phase 4. Before Step 21 has anything real to schedule against, note
Steps 22 (the cron endpoint) and 23 (adaptive difficulty) are still
unbuilt, so a schedule created via Step 21's UI won't actually fire
anything yet - same "build the UI ahead of its backend, flag it, keep
going" pattern as Phase 2's Generation UI session. Also carry forward: a
real RESEND_API_KEY needs to land in .env.local (and on Vercel) before any
of Step 20's 8 templates can actually be test-fired end to end - ask the
user for one, or proceed and defer that verification again, whichever they
prefer, next time email sending needs to be exercised for real.
Decisions: covered above (Kumon addition confirmed and documented; Student
Accounts contradiction resolved in favour of the Revised Decision).

---

SESSION UPDATE (following the one above):
Completed: Phase 4 Step 21 - Schedule UI. New /dashboard/schedule route:
page.tsx (Server Component - auth check, plan gate, fetches students +
existing schedules), ScheduleForm.tsx (create), ScheduleCard.tsx (one
schedule's display, inline edit, pause/resume, delete), actions.ts (5
Server Actions: create/update/pause/resume/delete). Gate is plan === 'pro'
regardless of role - Permissions Summary lists "automated schedule" under
both TUTOR and PARENT's paid plans and excludes it only for FREE, unlike
the marking dashboard's tutor-only gate. Added DELIVERY_TIMEZONES (6 zones
curated to the 3 supported countries) and DAY_OF_WEEK_LABELS to
src/lib/constants.ts, alongside the existing SUBJECTS/CURRICULUM_LEVELS/
DIFFICULTY_LEVELS.

"Pause until [date]" (User Challenges) sets paused_until and leaves
is_paused false, so the Automated Schedule Logic's own query
(is_paused = false AND (paused_until IS NULL OR paused_until < NOW()))
resumes it automatically once that date passes - no separate cron/job
needed for that part, it falls out of the query Step 22 will already need
to write. Leaving the pause date blank instead sets is_paused = true
(indefinite, needs an explicit "Resume now"). topics (schedules.topics
TEXT[]) is a plain comma-separated text input parsed server-side, not a
dynamic array-builder widget - simplest thing that works for the schema's
actual shape.

Two real bugs found and fixed via live verification, not just tsc/eslint:
1. After saving an edit, ScheduleCard never left edit mode - `editing` is
   local useState, and nothing ever set it back to false on a successful
   save, so the card would sit showing the edit form indefinitely (looking
   broken, not just stale) after every single edit. Caught by a real
   Puppeteer script that edited a schedule and then waited for the
   read-only card to reappear - it never did. Fixed by adding a
   `success?: boolean` flag to ScheduleActionResult (explicit true, not
   just "no error", so useActionState's initial {} can't be mistaken for a
   real success) and closing edit mode when it flips true.
2. The first fix attempt used `useEffect(() => { if (updateState.success)
   setEditing(false) }, [updateState])` - eslint's react-hooks/set-state-in-
   effect rule correctly flagged this (setState synchronously inside an
   effect body causes an extra cascading render, and React's own docs treat
   this as an anti-pattern with a documented alternative). Fixed using
   that alternative instead: compare updateState against a
   useState-tracked "last seen" value during render itself and adjust
   editing there, no effect at all. Worth remembering for any future
   useActionState + local-UI-state combination in this project - the
   effect version looks correct and even runs correctly, it's just the
   wrong tool for it.

Verified for real, end to end, with a live Puppeteer script (same pattern
as the marking-dashboard and Tier1/2 verification scripts): created a
confirmed parent-pro test account and a student via the admin API, logged
in through the real browser, created a schedule through the real form,
confirmed the card rendered with the correct day/time/topics, edited it
(day changed, confirmed the card updated and left edit mode - this is what
caught bug 1 above), paused it with a future date (confirmed "Paused
until..." status), resumed it, deleted it (confirmed the empty state), and
confirmed zero schedules remained in the database afterward. All test data
cleaned up. tsc --noEmit and eslint clean across the whole project.

Next: Phase 4 Step 22 - the Vercel Cron endpoint
(/api/cron/generate-scheduled, CRON_SECRET-protected, per-schedule failure
isolation with a retry after 10 minutes and an email to the owner on second
failure, per the Automated Schedule Logic and Technical Challenge 7
sections). This is the first real consumer of the schedules Step 21 just
built a UI for, and the first place EMAIL 3 (weekly delivery, built in Step
20 but not yet wired to any trigger) actually gets sent from. CRON_SECRET
is empty in .env.local - can be generated locally (it's just a shared
secret, not a third-party API key, so no external signup needed) rather
than asked of the user.
Decisions: none beyond the two bug fixes above, both corrections to
already-in-scope Step 21 work.

---

SESSION UPDATE (following the one above):
Opened per the dropped-session protocol: Current Build Status still said
"Next: Phase 4 Step 21" but Step 21 (Schedule UI) was actually already
complete and verified end to end in the prior session - just never
committed or written up. Reviewed it fresh (tsc/eslint clean, matched the
prior transcript's description) rather than redoing it, then committed and
updated the docs before moving on.

Completed: Phase 4 Step 22 - the Vercel Cron endpoint
(/api/cron/generate-scheduled - CRON_SECRET-protected, added to
vercel.json's new "crons" array at */30 * * * * per the Automated Schedule
Logic section). Generated CRON_SECRET locally (a shared secret, not a
third-party API key, so no external signup was needed) and added it to
.env.local directly. Due-schedule matching (timezone conversion via
Intl.DateTimeFormat, day/hour match, "more than 6 days since
last_generated_at") extracted into src/lib/schedule/isDueNow.ts specifically
so it's unit-testable - Testing Strategy explicitly lists "cron schedule
matching logic" under UNIT TESTS, not something to leave buried
un-exported inside a route file. 8 tests added at
src/__tests__/isDueNow.test.ts (day mismatch, hour mismatch, a genuine
cross-timezone conversion check between Europe/London and
America/Los_Angeles, the never-generated/3-days/8-days/exactly-6-days
last_generated_at boundary cases).

Per schedule: fetches the student profile and latest session_notes (Step 4
of Automated Schedule Logic - session_notes has no input UI yet, Phase 6
Steps 33-34, so this finds nothing today but the query is correctly wired
now rather than waiting), builds a prompt via the existing buildUserPrompt
(no dedicated difficulty parameter exists there - manual generation doesn't
pass one either, that's Step 23 - so schedules.difficulty is folded into
the topic text itself rather than silently discarded), generates via the
existing generateWorksheet(), stores the worksheet with
generated_from: 'scheduled' (same digital_code collision-retry pattern as
/api/generate), updates last_generated_at, and sends EMAIL 3 (built in Step
20, not wired to any trigger until now) to the student directly when
student_profiles.email is set, otherwise to the owner.

Documented, not silently decided: "retry once after 10 minutes" (Technical
Challenge 7) is implemented as an immediate retry within the same
invocation, not a literal 10-minute delay - Tech Stack lists no queue
service, and Vercel Cron can't re-invoke a route 10 minutes later without
either blocking the function for 10 minutes (bad) or a second cron entry
plus cross-invocation state (real added complexity for a timing nuance).
This satisfies the load-bearing requirements (independent per-schedule
processing, retry once, email the owner on second failure, never silently
skip) without the literal delay. Also flagged, not solved: a persistently
failing schedule would email its owner again every 30 minutes with no
suppression - noted in the route's own comment for a future
last_failure_notified_at column if it becomes a real problem. Built a 9th
email template, ScheduleFailed.tsx (not one of the 8 numbered ones - no
template exists anywhere for "cron failure notice to the owner", but
Technical Challenge 7 requires sending one), reusing the shared EmailLayout
rather than inventing a separate look.

Two real, live bugs found and fixed this session, neither caught by
tsc/eslint - both were "compiles fine, breaks the instant it actually
runs" issues:
1. `new Resend(undefined)` throws synchronously ("Missing API key") rather
   than deferring the failure to .emails.send() - src/lib/email/resend.ts
   constructed the client eagerly at module load in Step 20, which means
   every route importing send.tsx (signup's welcome email, this cron job)
   crashed the instant it loaded, with RESEND_API_KEY unset, before
   send.tsx's own "never throw" try/catch ever got a chance to run. This
   means EMAIL 1 (Welcome) has been silently crashing signup's fire-and-
   forget email call since Step 20 - not visibly breaking signup itself
   (the call is un-awaited-for-blocking, `void sendWelcomeEmailAction(...)`)
   but throwing an unhandled rejection server-side on every single signup,
   the whole time. Caught live in this session, not by tsc/eslint, when the
   cron endpoint's dev-server log showed the actual thrown error - the
   Step 20 session's own verification only got as far as "compiles and
   type-checks against the real signature," explicitly not a live signup
   test, and this is exactly the kind of thing that gap missed. Fixed:
   resend.ts now lazily constructs the client only when actually sending,
   and send.tsx checks RESEND_API_KEY itself first, so the constructor
   never runs at all while the key is missing - confirmed with a direct
   call to sendWelcomeEmail() after the fix, resolved cleanly with `false`,
   no throw.
2. Found while verifying the fix above, unrelated to it: this dev machine
   had a stale `next dev` process running for 12+ hours from earlier in
   this session (survived across at least one conversation boundary),
   silently serving requests on port 3000 the whole time under an old
   in-memory module graph. Killed it (PID 2104) and started a clean server
   before re-verifying - not a code issue, but worth noting since it could
   have made a real bug look fixed (or a real fix look broken) depending on
   which server happened to answer a given request.

Verified for real: the cron endpoint's own logic (auth gate returning 401
with no/wrong Authorization header and 200 with the real CRON_SECRET,
correctly identifying a due schedule vs. skipping a not-due one) all
confirmed against the real running route via a throwaway script. The
actual generation happy-path could NOT be verified this session - see the
open risk below, this is an external account problem, not a code gap.

OPEN RISK, urgent, flagged directly to the user: the Anthropic API is
returning "This organization has been disabled" (400, invalid_request_error)
for every request, confirmed with a minimal, direct API call completely
outside this project's code (bare Anthropic SDK, one message, no app logic
involved). This blocks ALL AI generation right now, not just the cron
path - the existing manual /api/generate flow would fail identically. Not
fixable from here; the user needs to check the Anthropic Console
(billing/account status). The cron endpoint's retry-then-notify path was
incidentally exercised for real by this failure (attempted generation
twice, both failed, correctly logged, correctly attempted the owner
failure email and gracefully skipped it since RESEND_API_KEY is also
unset) - so that failure path is now genuinely verified, just not the
success path.

Next: Phase 4 Step 23 - Adaptive difficulty post-submission logic. Cannot
be meaningfully tested end-to-end until the Anthropic account issue above
is resolved (submissions can still be created and marked, but generating a
new worksheet to observe difficulty actually shift is blocked the same
way). Also still open from Step 20: RESEND_API_KEY is empty, so EMAIL 3's
actual delivery (and every other email) remains unverified live - ask the
user for a key whenever that's worth exercising for real.
Decisions: none beyond the "immediate retry, not literally 10 minutes"
interpretation documented above.

---

SESSION UPDATE (following the one above):
User checked the Anthropic Console: the organization is genuinely
unavailable right now, confirmed not a transient blip, and asked to
proceed without it - noted, and this session deliberately picked Step 23
next specifically because it doesn't need a live Claude call at all
(scoring and marking are already-stored data; adaptive difficulty only
reacts to a score that already exists).

Completed: Phase 4 Step 23 - adaptive difficulty post-submission logic.
New src/lib/adaptive/nextDifficulty.ts: nextDifficulty(current,
scorePercentage) is a pure function (Testing Strategy explicitly lists
"adaptive difficulty thresholds" under UNIT TESTS) - strict boundaries per
the spec text ("above 80" / "below 50", so exactly 80 and exactly 50 are
both no-change), returns null both for the mid-band and for an
already-at-the-cap request (e.g. 'higher' scoring 100% has nowhere higher
to go). 8 unit tests at src/__tests__/nextDifficulty.test.ts cover both
boundaries from both sides, both caps, and the mid-band.

Wired into src/app/dashboard/marking/[id]/actions.ts's saveMarkingAction,
the only place score_percentage is actually computed today (Steps 16/17's
decision holds: it stays NULL until a tutor finishes reviewing every
extended part, so this is the one real trigger point that exists, not
"after every submission" literally - there is no earlier point with a real
score to react to). Runs only when scorePercentage is non-null; reads
student_profiles.current_difficulty (falling back to 'standard' if the
stored value isn't one of the three known levels - the column has no CHECK
constraint, so this is a real defensive case, not a hypothetical one), and
updates it via nextDifficulty(). A failure updating current_difficulty is
logged but does not roll back or fail the marking save that already
succeeded - adaptive difficulty is a best-effort follow-on to a save, not
part of its own success/failure. SaveMarkingResult gained
difficultyNotice?: string, shown by MarkingForm.tsx as
"Difficulty adjusted based on recent performance." (spec's literal text)
only when a change actually happened.

Verified for real, end to end, entirely without the Anthropic API:
Tier 1 marking and this new logic are both pure/data-driven, so a
throwaway script hand-built a valid 10-question worksheet object (bypassing
generateWorksheet() entirely - no AI call anywhere in this path) and drove
three real submissions through the real /api/submit and
/dashboard/marking/[id] Save-marking flow via a live logged-in browser: a
9/10 (90%) score correctly flipped current_difficulty standard -> higher
with the notice shown; a subsequent 4/10 (40%) score correctly flipped
higher -> standard with the notice shown again; a 6/10 (60%) score
correctly left it unchanged at standard with no notice shown. All three
outcomes confirmed directly against the database, not just the UI text.
All test data cleaned up.

Next: Phase 4 Step 24 - Monday parent summary automated job. This needs
its own Vercel Cron entry (a weekly, not 30-minute, cadence) and will
finally give EMAIL 4 (built in Step 20, unused since) a real trigger. Like
Step 22, the actual email send still can't be verified live without a
RESEND_API_KEY. Step 25 (tutor parent report AI draft) is the next thing
after that which DOES need the Anthropic account back (an AI-drafted
report has no non-AI equivalent to fall back on for testing) - flag this
when Step 24 is done, rather than assuming Step 25 can proceed the same
way Step 23 just did.
Decisions: none beyond confirming the Step 23 approach above.

---

SESSION UPDATE (following the one above):
Completed: Phase 4 Step 24 - Monday parent summary automated job. New
/api/cron/monday-summary, CRON_SECRET-protected (same auth pattern as
Step 22), added to vercel.json's crons at "0 7 * * 1" (Monday 07:00 UTC) -
a single fixed time for every owner, since no per-owner delivery-time
preference exists anywhere in the schema (schedules.delivery_timezone is
per-schedule, not per-owner) - documented as a deliberate simplification,
not an oversight.

Gated to role = 'parent' AND plan = 'pro' only - Permissions Summary lists
"Monday summaries" exclusively under PARENT's paid plan, unlike Step 21's
schedules feature which both roles get (confirmed by re-reading Permissions
Summary carefully rather than assuming the same gate as last time). For
each such owner's students, aggregates the past 7 days of *scored*
submissions (score_percentage IS NOT NULL - same "only tutor-reviewed
submissions have a score" constraint Step 23 ran into) into worksheets
completed, average score, strongest topic, and area to improve, then sends
EMAIL 4 (built in Step 20, unused until now) to the owner.

Score/topic aggregation extracted to a pure function,
src/lib/summary/weeklySummary.ts's computeWeeklySummary() - same
"pure logic gets unit tests, extracted out of the route" discipline as
Step 22's isDueNow. 4 tests at src/__tests__/weeklySummary.test.ts: empty
week, a single submission (correctly both the strongest and weakest result
of one data point), multiple submissions picking the real
highest/lowest-scoring topics, and average-rounding (70.5 -> 71).

dashboardUrl in the email links to /dashboard/students, not
/dashboard/worksheets - Routing Structure documents a "/dashboard/worksheets
History" route but it has never been built as its own step (not scheduled
anywhere in Build Phases, same kind of gap /login and /signup used to be
before Step 12's session built them ahead of schedule). Did not build it
here either - out of scope for "the automated job," a real UI page deserves
its own attention - and /dashboard/marking (the obvious alternative) is
tutor-only and would dead-end a parent with an upsell message, so
/dashboard/students was the closest existing, working, role-appropriate
link.

Verified for real, end to end, entirely without the Anthropic API: a
throwaway script created a parent-pro owner with a student and inserted 3
worksheets/submissions directly (bypassing generation entirely, same
approach as Step 23's verification) with known scores across 3 topics, plus
one deliberately stale submission from 3 weeks ago to confirm the 7-day
window actually excludes it, plus a second, tutor-role owner with their own
student to confirm the role gate actually excludes them. Hit the real cron
endpoint with the real CRON_SECRET: auth gate returned 401 with no/wrong
header, then 200 for the real run, correctly processing only the parent-pro
owner (the tutor was never even fetched, confirmed by the query being
scoped to role = 'parent' before anything else runs).

This run surfaced a real, unrelated finding: the endpoint reported 2 owners
processed, not the 1 this session's own script created - querying directly
found a second genuine parent-pro leftover account
(verify-schedule-...@example.com) that Step 21's own verification script
had failed to fully clean up at the end of that session. Not a bug in this
session's work, but a real gap in a prior session's cleanup - found and
removed (student, worksheets, user, auth account) before finishing this
session. Worth remembering: verification scripts across this project
create real rows in the live production Supabase project, and a script
that errors out before reaching its own cleanup step leaves them behind
silently - periodically checking for stray verify-*@example.com accounts
(e.g. via auth.admin.listUsers()) is worth doing, not just trusting each
script's own happy-path cleanup ran.

Next: Phase 4 Step 25 - tutor parent report AI draft and approve flow. This
is the one that genuinely needs the Anthropic account back (an AI-drafted
report has no meaningful non-AI equivalent to build or test against) -
Phase 4 (Automation and Email) cannot fully finish without it. Everything
else reachable without a live Claude call in this phase (Steps 20-24) is
now done.
Decisions: none beyond the gate/link choices documented above.
