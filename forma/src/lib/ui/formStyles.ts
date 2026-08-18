// Shared Tailwind class strings for the Design System's INPUTS / BUTTONS /
// CARDS spec in CLAUDE.md - centralised so the exact spec'd values (padding,
// radius, colours, focus ring) don't drift across login, signup, and the
// student form instead of being copy-pasted three times.
//
// Design System v2: motion moved onto the shared --ease-premium curve and
// --duration-micro (150ms) scale defined in globals.css, replacing the
// generic duration-200/ease pairing every one of these used individually
// before - one shared feel across every interactive element, not a
// per-component guess.

export const inputClass =
  'w-full px-4 py-[14px] rounded-[10px] text-sm bg-white border border-[#E0D9D0] text-[#1A1A18] placeholder:text-[#9A9080] placeholder:italic outline-none focus:border-[#1A3D2E] focus:shadow-[0_0_0_3px_rgba(26,61,46,0.12)] transition-colors duration-micro ease-premium';

export const labelClass = 'block text-xs font-medium mb-1 text-[#5C5849]';

export const primaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white hover:bg-[#152F23] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';

export const secondaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium border-[1.5px] border-[#1A3D2E] text-[#1A3D2E] bg-transparent hover:bg-[#E8F2ED] active:scale-[0.98] transition-all duration-micro ease-premium';

// Border bumped from the original spec's 0.5px to a full 1px (Design
// System v2, revised) - a 0.5px CSS border rounds to 0 or renders
// inconsistently depending on display DPI, which was quietly killing the
// one other thing (besides the shadow) that should have separated a card
// from the page. Confirmed live in a browser: cards were reading as
// borderless. Colour is unchanged from the original spec.
export const cardClass =
  'bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card';

// Design System v2 elevation: for a card that's also a click target (a
// list row wrapped in <Link>, not a static info/form container) - lifts
// and escalates to the "raised" shadow level on hover rather than just
// the existing static shadow-card.
export const interactiveCardClass =
  'bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card hover:shadow-raised hover:border-[#C4B9AC] hover:-translate-y-0.5 transition-all duration-micro ease-premium';

// For the one primary action card per page (the form that IS the point of
// the page - add a student, generate a worksheet, add a session note) -
// a left accent rail in the brand gold, the same "coloured callout" technique
// used broadly in premium app UI (Notion, Linear) to mark "this is the
// thing to do here" without a heavy background fill or a gradient. Not
// for every card - data-display rows (list items, static info panels)
// stay on plain cardClass; using this everywhere would dilute it back to
// noise instead of a signal.
export const accentCardClass =
  'bg-[#F0EBE3] border-y border-r border-[#E0D9D0] border-l-[3px] border-l-[#C8A84B] rounded-[12px] p-6 shadow-card';
