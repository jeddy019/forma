import { describe, expect, it } from 'vitest';
import { slugifySubSkill } from '@/lib/subSkill/slugifySubSkill';

describe('slugifySubSkill', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugifySubSkill('Elimination Method')).toBe('elimination-method');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugifySubSkill('  word problems  ')).toBe('word-problems');
  });

  it('collapses punctuation into single hyphens', () => {
    expect(slugifySubSkill('Fractions: adding & subtracting')).toBe('fractions-adding-subtracting');
  });

  it('produces the same slug for differently-cased same names', () => {
    expect(slugifySubSkill('Substitution Method')).toBe(slugifySubSkill('substitution method'));
  });

  it('strips leading/trailing hyphens produced by punctuation at the edges', () => {
    expect(slugifySubSkill('-word problems-')).toBe('word-problems');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(slugifySubSkill('')).toBe('');
    expect(slugifySubSkill('   ')).toBe('');
  });
});
