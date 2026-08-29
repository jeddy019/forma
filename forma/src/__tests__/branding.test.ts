import { describe, expect, it } from 'vitest';
import { resolveBranding, BRANDING_DEFAULTS } from '@/lib/branding';

describe('resolveBranding', () => {
  it('falls back to platform defaults when the row is missing', () => {
    expect(resolveBranding(null)).toEqual(BRANDING_DEFAULTS);
    expect(resolveBranding(undefined)).toEqual(BRANDING_DEFAULTS);
    expect(resolveBranding({})).toEqual(BRANDING_DEFAULTS);
  });

  it('uses the stored brand name when set', () => {
    expect(resolveBranding({ brand_name: 'Aisha Ade' }).name).toBe('Aisha Ade');
  });

  it('trims whitespace from the stored name', () => {
    expect(resolveBranding({ brand_name: '  Aisha Ade  ' }).name).toBe('Aisha Ade');
  });

  it('ignores a blank name and falls back', () => {
    expect(resolveBranding({ brand_name: '   ' }).name).toBe(BRANDING_DEFAULTS.name);
  });

  it('normalises a valid stored accent to uppercase #RRGGBB', () => {
    expect(resolveBranding({ brand_accent: '#c8a84b' }).accent).toBe('#C8A84B');
  });

  it('falls back to the default accent for malformed values', () => {
    const bad = ['', '  ', '#12345', 'red', '##AABBCC', 'not-a-colour', '#GGGGGG'];
    for (const value of bad) {
      expect(resolveBranding({ brand_accent: value }).accent).toBe(BRANDING_DEFAULTS.accent);
    }
  });

  it('resolves name and accent independently', () => {
    const brand = resolveBranding({ brand_name: 'Aisha Ade', brand_accent: '#B8963C' });
    expect(brand).toEqual({ name: 'Aisha Ade', accent: '#B8963C' });
  });
});