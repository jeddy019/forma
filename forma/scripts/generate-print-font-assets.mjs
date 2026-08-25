// Generates src/lib/render/printFonts.generated.ts - the entire print
// typography payload (brand font woff2 files + katex.min.css with its glyph
// fonts inlined) as literal TypeScript constants.
//
// WHY A GENERATED FILE: Turbopack rewrites require.resolve() for asset files
// into virtual module IDs ("... (static in ecmascript)"), so reading fonts
// from node_modules at request time is impossible inside a bundled route -
// and silently falling back to CDN <link> tags is exactly what stalled real
// PDF downloads past their timeout (see CHANGELOG 2026-08-24/25). Literal
// source constants give every bundler and every deploy target the same
// bytes with zero resolution, zero filesystem access, zero network.
//
// Run via: npm run generate:print-fonts
// Re-run after upgrading @fontsource/* or katex. The generated file IS
// committed to git; this script only needs Node itself.

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();

const BRAND_FONTS = [
  ['Playfair Display', 400, '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2'],
  ['Playfair Display', 500, '@fontsource/playfair-display/files/playfair-display-latin-500-normal.woff2'],
  ['Playfair Display', 600, '@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2'],
  ['Inter', 300, '@fontsource/inter/files/inter-latin-300-normal.woff2'],
  ['Inter', 400, '@fontsource/inter/files/inter-latin-400-normal.woff2'],
  ['Inter', 500, '@fontsource/inter/files/inter-latin-500-normal.woff2'],
  ['Inter', 600, '@fontsource/inter/files/inter-latin-600-normal.woff2'],
  ['Fira Code', 400, '@fontsource/fira-code/files/fira-code-latin-400-normal.woff2'],
  ['Fira Code', 500, '@fontsource/fira-code/files/fira-code-latin-500-normal.woff2'],
];

function splitPackagePath(relPath) {
  // '@scope/name/files/x.woff2' -> ['@scope/name', 'files/x.woff2']
  // 'name/files/x.woff2'        -> ['name', 'files/x.woff2']
  const segs = relPath.split('/');
  const pkgLen = relPath.startsWith('@') ? 2 : 1;
  return [segs.slice(0, pkgLen).join('/'), segs.slice(pkgLen).join('/')];
}

let out = '';
out += `// GENERATED FILE - DO NOT EDIT BY HAND.\n`;
out += `// Regenerate with: npm run generate:print-fonts\n`;
out += `// Source of truth: scripts/generate-print-font-assets.mjs, which reads\n`;
out += `// @fontsource/* and katex packages from node_modules and embeds their\n`;
out += `// bytes here as literals. See printStyles.ts for why this must exist.\n\n`;

out += `export interface BrandFontFace {\n  family: string;\n  weight: number;\n  /** woff2 bytes, base64-encoded */\n  data: string;\n}\n\n`;

out += `export const BRAND_FONT_FACES: BrandFontFace[] = [\n`;
for (const [family, weight, relPath] of BRAND_FONTS) {
  const [pkg, sub] = splitPackagePath(relPath);
  const filePath = path.join(path.dirname(require.resolve(`${pkg}/package.json`)), sub);
  const data = readFileSync(filePath).toString('base64');
  out += `  { family: ${JSON.stringify(family)}, weight: ${weight}, data: ${JSON.stringify(data)} },\n`;
}
out += `];\n\n`;

// katex.min.css with every woff2 glyph font inlined as a data URI; the
// woff/truetype fallback sources are stripped so no relative URL survives.
const katexCssPath = require.resolve('katex/dist/katex.min.css');
const katexFontsDir = path.join(path.dirname(katexCssPath), 'fonts');
let css = readFileSync(katexCssPath, 'utf8');
css = css.replace(/url\((?:["']?)(fonts\/[^)"']+\.woff2)(?:["']?)\)\s*format\(["']?woff2["']?\)/g, (_m, relPath) => {
  const data = readFileSync(path.join(katexFontsDir, relPath.replace(/^fonts\//, ''))).toString('base64');
  return `url(data:font/woff2;base64,${data}) format("woff2")`;
});
css = css.replace(/,?url\(fonts\/[^)]+\.(?:woff|ttf)\)\s*format\(["']?(?:woff|truetype)["']?\)/g, '');
out += `export const KATEX_CSS_WITH_INLINED_FONTS: string = ${JSON.stringify(css)};\n`;

const target = path.join(repoRoot, 'src/lib/render/printFonts.generated.ts');
writeFileSync(target, out);
console.log(
  `Wrote ${target} (${(readFileSync(target).length / 1024).toFixed(0)}KB, ${BRAND_FONTS.length} brand faces + katex css)`
);
