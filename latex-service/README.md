# forma-latex-service

Self-hosted LuaLaTeX compile microservice for Forma's worksheet and mark-scheme
PDFs. A single authenticated endpoint: send LaTeX source (+ optional image
attachments), get back a compiled PDF or a diagnostic log. Knows nothing about
worksheets, students, or Forma's domain model — all of that lives in the
Next.js app (`forma/src/lib/pdf/worksheetLatexTemplate.ts` and
`markSchemeLatexTemplate.ts`), which is the only caller.

## API

`GET /health` — no auth. `{ status: 'ok' }`.

`POST /compile` — `Authorization: Bearer <LATEX_COMPILE_SECRET>` required.

Request body:
```json
{
  "source": "<full .tex document as a string>",
  "images": [{ "filename": "q3-a.png", "base64": "..." }]
}
```

Response: `200` with `Content-Type: application/pdf` and the compiled PDF as
the body, or `500` with `{ "error": "compile_failed", "log": "<tail of the
LaTeX log>" }` on a compile failure, or `400` for a malformed request.

## Security

- `shell-escape` is never enabled, anywhere. LaTeX can run shell commands via
  `\write18` when shell-escape is on — since this service compiles
  AI-influenced text, that stays off, full stop. Don't add `-shell-escape`
  or `--enable-write18` to the Dockerfile or the `lualatex` invocation in
  `src/server.ts`.
- The service refuses to start if `LATEX_COMPILE_SECRET` isn't set (fails
  closed, not open).
- Image filenames are validated against a strict allow-list pattern before
  being written to disk, to rule out path traversal.
- Runs as a non-root user inside the container.
- Every request gets its own temp directory, deleted in a `finally` block
  regardless of outcome — nothing persists between requests.

The real injection defense is upstream of this service, in
`forma/src/lib/pdf/escapeLatex.ts` — this service is a second, independent
layer (no shell-escape, non-root), not the primary one.

## Fonts — one thing to verify before trusting this in production

`fonts/` contains the actual OFL-licensed variable-weight TTF files for Inter
and Playfair Display (Forma's brand fonts), downloaded directly from
`google/fonts` — not fetched at Docker build time, so there's no network
dependency once the image is built. The Dockerfile registers them with
`fontconfig` (`fc-cache`), and the LaTeX templates load them by family name
("Inter", "Playfair Display") via `fontspec`'s variable-font axis syntax
(`UprightFont={*[wght=400]}` etc.) rather than a literal file path.

Font family names were verified directly (via `fontTools`, reading each
file's own `name` table) rather than assumed from the filenames: both
`Inter-Variable.ttf` and `Inter-Italic-Variable.ttf` register under the
same family, "Inter" (nameID 1), distinguished by style ("Regular" vs
"Italic", nameID 2) — not two separate families. That's why the LaTeX
preamble has no explicit `ItalicFont` key: `\itshape`/`\textit` should
resolve to the italic file automatically via that shared family name once
`fc-cache` has registered both. `PlayfairDisplay-Variable.ttf` registers as
"Playfair Display".

**The weight-axis selection has not been compiled and visually verified**
- there is no LaTeX toolchain available in the environment this service was
built in, so `lualatex`/`fontspec`'s variable-font handling could not be
test-compiled locally. It's written to match the documented `fontspec`
manual syntax, but the first real deploy should specifically check: does
`\textbf` actually render at the intended 600-weight (not a faked/emboldened
400), and does the italic alignment-note text use the real italic face (not
a slanted synthetic one)? If it doesn't, the fix is almost certainly in the
`FontAxis`/`UprightFont`/`BoldFont` keys in
`forma/src/lib/pdf/worksheetLatexTemplate.ts`'s preamble, not in these font
files themselves.

### STIX Two Math and Fira Code (the CLAUDE.md "future upgrade", now built)

Unlike Inter/Playfair Display above, these aren't bundled files - they come
from the Debian bookworm packages `fonts-stix` and `fonts-firacode`
(installed in the Dockerfile, verified to exist via `packages.debian.org`
before adding them). No `fontTools` inspection was needed the way it was for
the brand fonts: both have stable, well-documented family names rather than
custom/ambiguous ones - "STIX Two Math" is unicode-math's own canonical
manual example, and "Fira Code" is stable across every distribution of it.

`worksheetLatexTemplate.ts`/`markSchemeLatexTemplate.ts` load `unicode-math`
and `\setmathfont{STIX Two Math}` unconditionally (applies to every math
span, on every subject) via a separate `MATH_FONT_SETUP` block placed after
`amsmath`/`amssymb` load, per unicode-math's own documented load-order
requirement. Separately, `fontSetup(subject)` swaps the main body font to
Fira Code specifically for the four Computer Science subjects
(`CODING_SUBJECTS` in `forma/src/lib/constants.ts`) - there's no dedicated
"code block" field in the AI's JSON schema (code is written as plain text
inside a question's own `text` field, per the system prompt), so this
switches the whole question body font for those subjects rather than just
inline code spans, which is the closest fit available without a schema
change. Headings stay on `\headingfont` (Playfair Display) regardless of
subject.

Same caveat as the brand fonts: **not compiled or visually verified** -
confirm on first real deploy that `\setmathfont{STIX Two Math}` actually
resolves (not a silent fallback to Computer Modern) and that Fira Code's
Regular/Bold faces resolve correctly for Computer Science worksheets.

## Deploying to Render

`render.yaml` in this folder is a Render Blueprint - the dashboard's
**New → Blueprint** flow reads it directly (point it at
`latex-service/render.yaml` specifically, since it doesn't live at the repo
root), so most of what used to be manual per-field setup here is now just
confirming what the file already declares:

1. Push this repository to GitHub (or wherever Render pulls from) if it
   isn't already hosted there.
2. In Render: **New → Blueprint**, connect the repo, and set the Blueprint
   file path to `latex-service/render.yaml`.
3. When prompted for `LATEX_COMPILE_SECRET` (declared `sync: false` in the
   file, so it's never committed), paste a freshly generated random secret.
   Store the exact same value in Vercel as `LATEX_COMPILE_SECRET` too - they
   must match.
4. Confirm the plan Render shows for `forma-latex-service` - currently
   pinned to `free` in `render.yaml` (a deliberate choice, see that file's
   own comment: no payment info required, at the cost of a real OOM risk
   under concurrent LuaLaTeX compiles and a cold start after 15 minutes
   idle). Upgrade to at least Standard directly in the dashboard whenever
   payment info stops being the blocker - no code change needed for that.
5. If still on the free plan, remember the cold-start cost specifically:
   the first PDF request after 15 minutes idle pays a full container
   cold-start on top of the LuaLaTeX compile itself - worth checking
   against `forma/src/app/api/pdf/route.ts`'s `PDF_TIMEOUT_MS` (25s) /
   `vercel.json`'s `maxDuration` (60s) budget for that route, since a cold
   start could plausibly blow both.
6. Once deployed, note the service URL (`https://<name>.onrender.com`) and
   set it as `LATEX_COMPILE_URL` in Vercel.
7. Verify with `curl https://<name>.onrender.com/health` before wiring
   anything up on the Forma side.

## Local development

```
npm install
npm run build
LATEX_COMPILE_SECRET=dev-secret node dist/server.js
```

This requires a local LuaLaTeX installation (e.g. a TeX Live install) on
whatever machine runs it directly outside Docker — or just build and run the
Docker image locally instead, which is closer to production:

```
docker build -t forma-latex-service .
docker run -p 8080:8080 -e LATEX_COMPILE_SECRET=dev-secret forma-latex-service
```
