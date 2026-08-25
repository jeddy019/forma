// Client-safe rich-text core, split out of worksheetHtml.ts deliberately:
// Turbopack cannot place the full document renderer (which pulls in
// qrcode-generator and node:fs/createRequire for CSS inlining) into BOTH
// an App Route graph (/api/pdf) and a React Server Component graph
// (/s/[code]/page.tsx) - "non-ecmascript placeable asset" build failure.
// This module depends on nothing Node-specific, so both graphs consume it
// cleanly and print + digital interpret AI output through literally the
// same function.
//
// Subject loopholes closed here:
//   - Sciences: units arrive as plain LaTeX ($5\,\text{m/s}$) after the
//     system-prompt fix; a defensive \si/\SI macro shim renders any legacy
//     siunitx output instead of leaking red parse errors onto the page.
//   - Computer Science: code arrives in ``` fences and renders as monospace
//     blocks; everything outside fences is HTML-escaped, so literal <div>
//     style text in HTML/CSS questions can never be parsed as markup.
//   - Every subject: math spans go through KaTeX (throwOnError false), so a
//     malformed expression degrades to visible raw text, never a crash.
import 'katex/contrib/mhchem';
import katex from 'katex';
import { escapeHtml } from '../pdf/worksheet-template';

export const KATEX_MACROS: Record<string, string> = {
  // Legacy-output shims. The system prompt no longer asks for siunitx, but
  // anything already generated with \si{5}{\meter\per\second}-style units
  // must still render correctly rather than erroring.
  '\\si': '#1\\,\\mathrm{#2}',
  '\\SI': '#1\\,\\mathrm{#2}',
  '\\per': '/',
  '\\of': '',
  '\\meter': 'm',
  '\\metre': 'm',
  '\\second': 's',
  '\\kilogram': 'kg',
  '\\gram': 'g',
  '\\newton': 'N',
  '\\joule': 'J',
  '\\watt': 'W',
  '\\ampere': 'A',
  '\\volt': 'V',
  '\\ohm': '\\Omega',
  '\\kelvin': 'K',
  '\\celsius': '{}^{\\circ}\\mathrm{C}',
  '\\litre': 'L',
  '\\mole': 'mol',
};

function katexRender(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
      trust: false,
      macros: KATEX_MACROS,
    });
  } catch {
    // Unreachable with throwOnError:false, kept as belt-and-braces: raw text
    // beats a crashed render.
    return escapeHtml(tex);
  }
}

const FENCE_RE = /```[a-zA-Z0-9+#-]*[ \t]*\r?\n([\s\S]*?)```/g;
const DISPLAY_MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\begin\{(?:align|align\*|aligned|gather|gathered|cases)\}[\s\S]*?\\end\{(?:align|align\*|aligned|gather|gathered|cases)\})/g;
const INLINE_MATH_RE = /(\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;

function renderMathSpans(chunk: string): string {
  return chunk
    .split(DISPLAY_MATH_RE)
    .map((piece) => {
      if (!piece) return '';
      if (/^\$\$[\s\S]+\$\$$/.test(piece) || /^\\\[[\s\S]+\\\]$/.test(piece)) {
        return katexRender(piece.replace(/^(\$\$|\\\[)|(\$\$|\\\])$/g, ''), true);
      }
      if (/^\\begin\{/.test(piece)) {
        return katexRender(piece, true);
      }
      return piece
        .split(INLINE_MATH_RE)
        .map((inline) => {
          if (!inline) return '';
          if (/^\$[^$\n]+\$$/.test(inline)) {
            return katexRender(inline.slice(1, -1), false);
          }
          if (/^\\\([\s\S]+\\\)$/.test(inline)) {
            return katexRender(inline.slice(2, -2), false);
          }
          // Prose: escaped, with hard newlines preserved (the AI writes real
          // line breaks for things like poem extracts in English Literature).
          // Bare \ce{...} tokens (mhchem) arrive outside math spans both from
          // legacy rows and occasionally fresh output - lift each into its own
          // KaTeX render instead of leaking raw "\ce" onto the page.
          return escapeHtml(inline)
            .replace(/\r?\n/g, '<br>')
            .replace(/\\ce\{([^{}]*)\}/g, (_, body: string) => katexRender(`\\ce{${body}}`, false));
        })
        .join('');
    })
    .join('');
}

export function renderRichText(raw: string): string {
  return raw
    .split(FENCE_RE)
    .map((part, index) => {
      // split() with a capture group alternates [prose, code, prose, code...]
      if (index % 2 === 1) {
        return `<pre class="code-block"><code>${escapeHtml(part.replace(/\r\n/g, '\n').replace(/\n$/, ''))}</code></pre>`;
      }
      return renderMathSpans(part);
    })
    .join('');
}
