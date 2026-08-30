import { describe, expect, it } from 'vitest';
import { familyReadySubject } from '@/lib/email/familyReadySubject';

describe('familyReadySubject', () => {
  it('returns a fallback when there are no entries', () => {
    expect(familyReadySubject([])).toBe('Practice is ready');
  });

  it('skips blank names entirely', () => {
    expect(familyReadySubject([{ name: '   ' }, { name: '' }])).toBe('Practice is ready');
  });

  it('uses the child first name only for one child', () => {
    expect(familyReadySubject([{ name: 'Aisha Okafor' }])).toBe("Aisha's worksheet is ready");
  });

  it('joins two children with "and" and plurals worksheets', () => {
    expect(familyReadySubject([{ name: 'Aisha' }, { name: 'Titilayo' }])).toBe(
      "Aisha and Titilayo's worksheets are ready"
    );
  });

  it('joins three children with a comma, and, and plural worksheets', () => {
    expect(familyReadySubject([{ name: 'Aisha' }, { name: 'Titilayo' }, { name: 'Kofi' }])).toBe(
      "Aisha, Titilayo and Kofi's worksheets are ready"
    );
  });

  it('stays grammatical beyond the 3-child cap', () => {
    expect(familyReadySubject([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }])).toBe(
      "A, B, C and D's worksheets are ready"
    );
  });

  it('treats whitespace-padded names as normal', () => {
    expect(familyReadySubject([{ name: '  Aisha  ' }])).toBe("Aisha's worksheet is ready");
  });
});