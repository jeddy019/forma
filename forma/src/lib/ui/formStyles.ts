// Shared Tailwind class strings for the Design System's INPUTS / BUTTONS /
// CARDS spec in CLAUDE.md - centralised so the exact spec'd values (padding,
// radius, colours, focus ring) don't drift across login, signup, and the
// student form instead of being copy-pasted three times.

export const inputClass =
  'w-full px-4 py-[14px] rounded-[10px] text-sm bg-white border border-[#E0D9D0] text-[#1A1A18] placeholder:text-[#9A9080] placeholder:italic outline-none focus:border-[#1A3D2E] focus:shadow-[0_0_0_3px_rgba(26,61,46,0.12)] transition-colors duration-200';

export const labelClass = 'block text-xs font-medium mb-1 text-[#5C5849]';

export const primaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white hover:bg-[#152F23] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed';

export const secondaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium border-[1.5px] border-[#1A3D2E] text-[#1A3D2E] bg-transparent hover:bg-[#E8F2ED] transition-colors duration-200';

export const cardClass =
  'bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]';
