import { BRAND_FONT_FACES, KATEX_CSS_WITH_INLINED_FONTS } from './printFonts.generated';

// ---------------------------------------------------------------------------
// Fully self-contained print typography. Every font a printed document needs
// is embedded in the bundle as a base64 data URI (see printFonts.generated.ts
// and scripts/generate-print-font-assets.mjs), built once per process and
// reused.
//
// WHY THIS EXISTS: printed documents used to fetch Playfair Display/Inter/
// Fira Code from Google Fonts and KaTeX glyph fonts from jsdelivr AT PRINT
// TIME inside headless Chromium. Those fetches stalled past the /api/pdf
// timeout on real downloads. The first fix attempt read fonts from
// node_modules at request time via createRequire().resolve() - which ALSO
// failed, because Turbopack rewrites asset resolves into virtual module IDs
// ("...woff2 (static in ecmascript)"), yielding ENOENT at runtime. The same
// mangling, silently caught, was how CDN fallback <link> tags had snuck back
// into documents and caused the original 504s. Literal generated constants
// are the only form every bundler, dev server, and deploy target agrees on:
// zero module resolution, zero filesystem access, zero network.
//
// There is deliberately NO fallback path anywhere in this file - if fonts go
// missing, regenerate via `npm run generate:print-fonts`; never reintroduce
// a runtime fetch.
//
// Consumed by render/worksheetHtml.ts (worksheets + mark schemes) and
// pdf/invoice-template.ts (invoices). The /s/[code] digital page does NOT
// use this - its CSS arrives through Next's own bundler.
// ---------------------------------------------------------------------------

function fontFace(family: string, weight: number, base64: string): string {
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
    cachedFontFaces = BRAND_FONT_FACES.map((face) =>
      fontFace(face.family, face.weight, face.data)
    ).join('\n');
  }
  return cachedFontFaces;
}

let cachedKatexStyles: string | null = null;

// katex.min.css with its glyph fonts already inlined as data URIs by the
// generator script.
export function printKatexStyles(): string {
  if (cachedKatexStyles === null) {
    cachedKatexStyles = KATEX_CSS_WITH_INLINED_FONTS;
  }
  return cachedKatexStyles;
}

// One ready-to-emit <head> fragment for documents with maths notation -
// everything self-contained, nothing fetched over the network at print time.
export function printDocumentHead(): string {
  return `<style>\n${printFontFaces()}\n</style>\n<style>\n${printKatexStyles()}\n</style>`;
}
