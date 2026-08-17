// Every diagram function interpolates AI-generated label/text strings
// directly into SVG markup. That was already reaching a real browser DOM
// only via Puppeteer (PDF generation) until Phase 2 Step 13 added the
// /s/[code] student page, which renders these same SVG strings straight
// into a real visitor's browser via dangerouslySetInnerHTML - an unescaped
// '<' or 'on...=' in a diagram label would be a stored XSS vector there.
// Applied at every point a diagram function embeds a string value as SVG
// text content (never to full markup, which is meant to stay markup).
export function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
