import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// ---------------------------------------------------------------------------
// Fully self-contained print typography. Every font a printed document needs
// is embedded here as a base64 data URI, built once per process and reused.
//
// WHY THIS EXISTS: printed documents used to fetch Playfair Display/Inter/
// Fira Code from Google Fonts and KaTeX glyph fonts from jsdelivr AT PRINT
// TIME inside headless Chromium. Those fetches stalled past the /api/pdf
// timeout on real downloads (both live attempts returned 504 while curl to
// the same CDNs succeeded - the stall is inside Chromium's network stack,
// not the machine's connectivity). Baking the fonts into the document makes
// printing fully offline-capable and deterministic; there is deliberately
// NO CDN fallback anywhere in this file - a missing font file must fail
// loudly here rather than quietly reintroducing a network dependency.
//
// Consumed by render/worksheetHtml.ts (worksheets + mark schemes) and
// pdf/invoice-template.ts (invoices). The /s/[code] digital page does NOT
// use this - its CSS arrives through Next's own bundler, which resolves
// font URLs at build time.
//
// TURBOPACK CONSTRAINT (same class of issue found live during R3): every
// require.resolve below MUST take a string literal directly. A resolve whose
// argument is a runtime variable emits "Can't resolve <dynamic>" at build
// and fails page-data collection for /api/pdf. readFileSync on a computed
// path is fine - only module resolution is statically analysed.
// ---------------------------------------------------------------------------

const require = createRequire(import.meta.url);

// Resolved lazily (never at module-evaluation time): this module loads inside
// Turbopack's build sandbox when route graphs are collected, where real
// filesystem access is unavailable (EBADF). Literal arguments stay mandatory.
const FONT_FILES = [
  ['Playfair Display', 400, '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2'],
  ['Playfair Display', 500, '@fontsource/playfair-display/files/playfair-display-latin-500-normal.woff2'],
  ['Playfair Display', 600, '@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2'],
  ['Inter', 300, '@fontsource/inter/files/inter-latin-300-normal.woff2'],
  ['Inter', 400, '@fontsource/inter/files/inter-latin-400-normal.woff2'],
  ['Inter', 500, '@fontsource/inter/files/inter-latin-500-normal.woff2'],
  ['Inter', 600, '@fontsource/inter/files/inter-latin-600-normal.woff2'],
  ['Fira Code', 400, '@fontsource/fira-code/files/fira-code-latin-400-normal.woff2'],
  ['Fira Code', 500, '@fontsource/fira-code/files/fira-code-latin-500-normal.woff2'],
] as const;

function fontFace(family: string, weight: number, woff2Path: string): string {
  const base64 = readFileSync(woff2Path).toString('base64');
  return (
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
    `src:url(data:font/woff2;base64,${base64}) format('woff2');}`
  );
}

let cachedFontFaces: string | null = null;

// Brand typefaces only - no KaTeX rules. Invoices embed this (they have
// words, not maths); worksheets and mark schemes get it plus katex below.
export function printFontFaces(): string {
  if (cachedFontFaces === null) {
    cachedFontFaces = FONT_FILES.map(([family, weight, file]) =>
      fontFace(family, weight, require.resolve(file))
    ).join('\n');
  }
  return cachedFontFaces;
}

let cachedKatexStyles: string | null = null;

// katex.min.css with every glyph font inlined as a data URI. Only the woff2
// sources are embedded (Chromium always picks the first supported source);
// the woff/truetype fallback entries are stripped so no relative URL survives
// for Chromium to even attempt resolving against about:blank.
export function printKatexStyles(): string {
  if (cachedKatexStyles === null) {
    const cssPath = require.resolve('katex/dist/katex.min.css');
    let css = readFileSync(cssPath, 'utf8');

    const fontsDir = cssPath.replace(/katex\.min\.css$/, 'fonts');
    css = css.replace(/url\((?:["']?)(fonts\/[^)"']+\.woff2)(?:["']?)\)\s*format\(["']?woff2["']?\)/g, (_match, relPath: string) => {
      const base64 = readFileSync(`${fontsDir}/${relPath.replace(/^fonts\//, '')}`).toString('base64');
      return `url(data:font/woff2;base64,${base64}) format("woff2")`;
    });
    css = css.replace(/,?url\(fonts\/[^)]+\.(?:woff|ttf)\)\s*format\(["']?(?:woff|truetype)["']?\)/g, '');

    cachedKatexStyles = css;
  }
  return cachedKatexStyles;
}

// One ready-to-emit <head> fragment for documents with maths notation -
// everything self-contained, nothing fetched over the network at print time.
export function printDocumentHead(): string {
  return `<style>\n${printFontFaces()}\n</style>\n<style>\n${printKatexStyles()}\n</style>`;
}
