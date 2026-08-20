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

# Brand fonts - variable-weight OFL files (see fonts/OFL-*.txt), registered
# with fontconfig so fontspec can find them by family name ("Inter",
# "Playfair Display") rather than a brittle exact-filename Path lookup.
COPY fonts/*.ttf /usr/share/fonts/truetype/forma/
RUN fc-cache -f

# Non-root: this service compiles AI-influenced LaTeX source. Even with
# shell-escape disabled (never enable it - see server.ts), running as an
# unprivileged user is a second, independent layer of containment.
RUN groupadd -r forma && useradd -r -g forma -m forma
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
