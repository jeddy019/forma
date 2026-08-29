// W1 identity layer - one source of truth for the account's own brand.
//
// The platform runs under the founder's name, not "Forma". These two columns
// live on the users row (see supabase/add-branding.sql); every consumer
// (dashboard wordmark, PDF wordmarks/footers, and later emails/public pages)
// resolves its brand through this module so "what is this account called"
// never has more than one answer.
//
// Pure logic with defaults, in its own module for the same reason
// isActivePro/nextDifficulty/isDueNow are: unit-testable without Supabase.
export interface Branding {
  /** Shown as the wordmark on dashboards, PDFs, and invoices. */
  name: string;
  /** The accent used for wordmarks and rules on branded documents. */
  accent: string;
}

// Fallbacks when the account hasn't set a brand yet. Kept equal to the
// product's own identity so an unset account reads exactly like the platform
// did before this layer existed - no behaviour change until a brand is set.
export const BRANDING_DEFAULTS: Branding = {
  name: 'Forma',
  accent: '#1A3D2E',
};

export interface BrandingRow {
  brand_name?: string | null;
  brand_accent?: string | null;
}

export function resolveBranding(row?: BrandingRow | null): Branding {
  const name = row?.brand_name?.trim();
  const accent = row?.brand_accent?.trim();
  return {
    name: name && name.length > 0 ? name : BRANDING_DEFAULTS.name,
    // Only accept values that look like a real #RRGGBB hex colour - a
    // malformed accent (someone pasted a name into the field via SQL, or a
    // future editor stored something off-spec) must fall back rather than
    // break every CSS `color:` a downstream consumer emits.
    accent: accent && /^#[0-9a-fA-F]{6}$/.test(accent) ? accent.toUpperCase() : BRANDING_DEFAULTS.accent,
  };
}