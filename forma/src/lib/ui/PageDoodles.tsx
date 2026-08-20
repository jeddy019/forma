// Dr Frost Maths fills empty canvas with loose line-sketches of maths
// content directly on its background - confirmed live (drfrost.org), the
// user specifically asked whether that technique could translate into
// Forma. Adapted rather than copied: instead of generic maths doodles in
// Dr Frost's bold amber, these are thin line-art versions of diagram types
// Forma's own worksheets already draw (see src/lib/diagrams/ -
// drawRightAngleTriangle, drawCoordinateGrid) - the product's own visual
// language filling its own empty space, at low opacity in the existing
// brand colours, not a borrowed illustration style. Clean geometric line
// art rather than an attempt at Dr Frost's hand-drawn wobble - faking
// authentic sketchiness in hand-coded SVG paths risks reading as a
// rendering bug rather than an intentional mark.
//
// Purely decorative (pointer-events-none, aria-hidden) and only shown from
// the xl breakpoint up - below that the sidebar+content already fills the
// viewport and there is no real gutter for these to occupy without
// overlapping real content.
//
// Deliberately just one mark, confined to the header row's own fixed
// height (top-4, capped at 90px tall) rather than spanning further down -
// confirmed live this actually matters: a first attempt at two doodles
// (this one plus a second, taller one lower on the page) looked right on
// the narrower Generate page but visibly clipped behind list cards on
// Marking, where content runs wider. The header band is the one zone that
// is reliably empty on every dashboard page regardless of how wide or
// tall that page's content is - a second, lower doodle would need
// per-page placement (content height varies) rather than one shared rule,
// left for a follow-up rather than shipped unverified.
export function PageDoodles() {
  return (
    <div className="hidden xl:block pointer-events-none select-none" aria-hidden="true">
      <svg
        className="absolute top-4 right-8 text-[#E0D9D0] opacity-70"
        width="110"
        height="90"
        viewBox="0 0 110 90"
        fill="none"
      >
        <path d="M6 84 L6 6 L102 84 Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 72 L18 72 L18 84" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
