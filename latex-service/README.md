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
— there is no LaTeX toolchain available in the environment this service was
built in, so `lualatex`/`fontspec`'s variable-font handling could not be
test-compiled locally. It's written to match the documented `fontspec`
manual syntax, but the first real deploy should specifically check: does
`\textbf` actually render at the intended 600-weight (not a faked/emboldened
400), and does the italic alignment-note text use the real italic face (not
a slanted synthetic one)? If it doesn't, the fix is almost certainly in the
`FontAxis`/`UprightFont`/`BoldFont` keys in
`forma/src/lib/pdf/worksheetLatexTemplate.ts`'s preamble, not in these font
files themselves.

## Deploying to Render

These steps are manual — done in Render's dashboard, not something this
session can do from here:

1. Push this repository to GitHub (or wherever Render pulls from) if it
   isn't already hosted there.
2. In Render: **New → Web Service**, connect the repo, set **Root Directory**
   to `latex-service`, **Runtime** to Docker (it will pick up this
   `Dockerfile` automatically).
3. Set the environment variable `LATEX_COMPILE_SECRET` to a freshly generated
   random secret. Store the exact same value in Vercel as `LATEX_COMPILE_SECRET`
   too — they must match.
4. Pick an instance plan with enough RAM/CPU for LuaLaTeX compiles under
   ~3 concurrent jobs (`MAX_CONCURRENT` in `src/server.ts`) — check Render's
   current pricing/plan page directly, sizing wasn't guessed here.
5. Decide whether the chosen plan tier spins down on idle. If it does, the
   first PDF request after idle pays a full container cold-start on top of
   the LuaLaTeX compile itself — worth checking against
   `forma/src/app/api/pdf/route.ts`'s `PDF_TIMEOUT_MS` (25s) /
   `vercel.json`'s `maxDuration` (60s) budget for that route.
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
