# Forma LaTeX compile microservice.
#
# A deliberately "broad, not minimal" TeX Live install: hand-picking the
# exact Debian sub-packages for every LaTeX package this project uses
# (amsmath, tcolorbox, enumitem, siunitx, mhchem, needspace, lastpage, tikz,
# pgfplots, circuitikz, fontspec...) is fragile - Debian's texlive-* split
# points move across releases, and a missing one silently breaks every PDF
# in production. Render isn't Vercel-size-constrained, so a larger image
# trades disk/build time (cheap, one-time) for reliability (not cheap to
# get wrong). Trim this list later if image size/build time becomes a real
# problem, not preemptively.
FROM node:22-bookworm-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-luatex \
    texlive-pictures \
    texlive-science \
    texlive-plain-generic \
    lmodern \
    fonts-stix \
    fonts-firacode \
    fontconfig \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# fonts-stix (STIX Two Math/Text) and fonts-firacode (Fira Code) are real
# Debian bookworm packages - used instead of bundling our own binaries the
# way the brand fonts below are, since both have stable, well-documented
# family names ("STIX Two Math" is unicode-math's own canonical manual
# example; "Fira Code" is stable across every distribution of it) and
# aren't Forma-specific, unlike Inter/Playfair Display. See
# worksheetLatexTemplate.ts's MATH_FONT_SETUP and fontSetup() for how
# they're used, and README.md's Fonts section for the same not-yet-
# compiled caveat that applies to the brand fonts below.

# Non-root: this service compiles AI-influenced LaTeX source. Even with
# shell-escape disabled (never enable it - see server.ts), running as an
# unprivileged user is a second, independent layer of containment. Moved
# earlier than before (was after font setup) so the luaotfload cache step
# below can be chown'd to this user instead of staying root-owned.
RUN groupadd -r forma && useradd -r -g forma -m forma

# Brand fonts - variable-weight OFL files (see fonts/OFL-*.txt), registered
# with fontconfig so fontspec can find them by family name ("Inter",
# "Playfair Display") rather than a brittle exact-filename Path lookup.
COPY fonts/*.ttf /usr/share/fonts/truetype/forma/
RUN fc-cache -f

# Real deploy bug found and fixed live (2026-08-20), via the actual /compile
# error log: the first-ever real generation on Render returned "compile
# timed out" - not a LaTeX syntax error, but luaotfload (LuaTeX's font
# loader) building its font-names database from scratch on first use ("db:
# Font names database not found, generating new one... This can take
# several minutes"), scanning the full texlive-fonts-extra install plus
# fonts-stix/fonts-firacode/the bundled brand fonts - all comfortably
# longer than COMPILE_TIMEOUT_MS (20s per lualatex pass, src/server.ts).
# Worse on Render's free plan specifically (see render.yaml/README.md):
# the container spins down after 15 minutes idle, so without a fix this
# multi-minute regeneration would repeat on every cold start, not just once
# ever. Fixed by pre-building the cache at image-build time instead of
# first-request time. Both TEXMFVAR *and* TEXMFCACHE are pinned to the same
# explicit path: luaotfload's own man page says the names database lands in
# "$TEXMFCACHE as set in texmf.cnf"-resolved texmf-var/luatex-cache/, and
# whether Debian bookworm's texmf.cnf derives TEXMFCACHE from TEXMFVAR or
# resolves it independently is exactly the kind of detail we can't verify
# without running the image - pinning both removes the ambiguity entirely,
# so the build-time (root) and runtime (forma) invocations of lualatex share
# the same cache location whichever variable kpathsea consults.
#
# The RUN below is deliberately loud and self-verifying (added after the
# 2026-08-22 deploy whose build log contained ZERO luaotfload matches yet
# still "succeeded" with the identical error): the FORMA-FONTCACHE markers
# make the step trivially searchable in Render's build log, and the
# find|test guard FAILS THE BUILD if no database file actually landed under
# the pinned tree - a silent no-op here would otherwise resurface as the
# same first-request timeout, hours later, in production.
ENV TEXMFVAR=/var/cache/texmf-var
ENV TEXMFCACHE=/var/cache/texmf-var
# chown deliberately happens AFTER luaotfload-tool below, not before:
# --update runs as root during build, so every file it creates is
# root-owned. Chowning the empty dir upfront (the original order) left the
# freshly-built database root-owned, and the runtime forma user then failed
# every cache write - "Lookup cache file not writable" (found live
# 2026-08-22 via direct /compile diagnostics, after the prebuild itself
# was confirmed working by the same log no longer saying "Font names
# database not found"). Owning the whole tree also lets lualatex persist
# per-font lookup caches and generated tables at runtime.
RUN mkdir -p /var/cache/texmf-var
RUN echo "FORMA-FONTCACHE-START building luaotfload names database" \
  && luaotfload-tool --update \
  && find /var/cache/texmf-var -name "luaotfload-names*" | tee /tmp/forma-fontcache-results.txt \
  && test -s /tmp/forma-fontcache-results.txt \
  && echo "FORMA-FONTCACHE-DONE database verified present"
RUN chown -R forma:forma /var/cache/texmf-var

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# Deploy failure found and fixed live (2026-08-20): "npm install --omit=dev"
# here skips devDependencies entirely, which is where typescript,
# @types/node, and @types/express all live (package.json) - the tsc build
# above then had no type declarations to compile against at all (every
# "Cannot find name 'process'/'console'/'Buffer'" error was this, not a
# real code bug), and npx's "--package=typescript" flag was separately
# fetching a fresh, unpinned typescript from the registry instead of using
# the pinned ^5.6.0 devDependency, compounding the confusion. Fixed by
# installing the full dependency tree (including dev) before the build,
# letting npx resolve typescript from node_modules/.bin like it should,
# then pruning dev-only packages afterward so the final image doesn't
# carry typescript/@types/* it no longer needs at runtime.
RUN npm prune --omit=dev

RUN mkdir -p /app/scratch && chown -R forma:forma /app
USER forma

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
