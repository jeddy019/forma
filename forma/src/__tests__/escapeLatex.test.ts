import { describe, expect, it } from 'vitest';
import { escapeLatexOutsideMath } from '../lib/pdf/escapeLatex';

describe('escapeLatexOutsideMath', () => {
  it('leaves plain text without special characters untouched', () => {
    expect(escapeLatexOutsideMath('Work out the value of x.')).toBe('Work out the value of x.');
  });

  it('escapes special characters outside math spans', () => {
    expect(escapeLatexOutsideMath('20% of students got 5 & 6 right, #1 mistake was x_1')).toBe(
      '20\\% of students got 5 \\& 6 right, \\#1 mistake was x\\_1'
    );
  });

  it('leaves $...$ math spans untouched', () => {
    expect(escapeLatexOutsideMath('The value of $x^2 + y_1$ is shown below.')).toBe(
      'The value of $x^2 + y_1$ is shown below.'
    );
  });

  it('leaves \\(...\\) math spans untouched', () => {
    expect(escapeLatexOutsideMath('Simplify \\(\\dfrac{1}{2} + \\dfrac{1}{4}\\) fully.')).toBe(
      'Simplify \\(\\dfrac{1}{2} + \\dfrac{1}{4}\\) fully.'
    );
  });

  it('escapes text around a math span but not the math itself', () => {
    expect(escapeLatexOutsideMath('20% chance that $x = 5$ & nothing else')).toBe(
      '20\\% chance that $x = 5$ \\& nothing else'
    );
  });

  it('escapes an unpaired dollar sign used as currency, not math', () => {
    expect(escapeLatexOutsideMath('The book costs $5 to buy.')).toBe('The book costs \\$5 to buy.');
  });

  it('escapes tilde and caret', () => {
    expect(escapeLatexOutsideMath('Approximately ~10 items, x^2 written as text')).toBe(
      'Approximately \\textasciitilde{}10 items, x\\textasciicircum{}2 written as text'
    );
  });

  it('escapes a literal backslash without corrupting subsequent escapes', () => {
    expect(escapeLatexOutsideMath('a \\ b % c')).toBe('a \\textbackslash{} b \\% c');
  });

  it('strips \\input and neutralizes its argument as inert text', () => {
    const result = escapeLatexOutsideMath('Before \\input{/etc/passwd} after');
    expect(result).not.toContain('\\input');
    expect(result).toBe('Before  after');
  });

  it('strips \\write18 shell-escape attempts', () => {
    const result = escapeLatexOutsideMath('\\write18{whoami}');
    expect(result).not.toContain('\\write18');
    expect(result).not.toContain('whoami');
  });

  it('strips \\def redefinition attempts while preserving surrounding math', () => {
    const result = escapeLatexOutsideMath('$x^2$ \\def\\foo{bar} plain text');
    expect(result).toContain('$x^2$');
    expect(result).not.toContain('\\def');
  });

  it('strips a bare \\let with no braces', () => {
    const result = escapeLatexOutsideMath('\\let\\x=\\input dangerous');
    expect(result).not.toContain('\\let');
    // \input itself is also on the dangerous list and gets stripped too.
    expect(result).not.toContain('\\input');
  });

  it('strips \\usepackage attempts', () => {
    const result = escapeLatexOutsideMath('\\usepackage{evil-package} normal text');
    expect(result).not.toContain('\\usepackage');
    expect(result).toContain('normal text');
  });

  it('handles an empty string', () => {
    expect(escapeLatexOutsideMath('')).toBe('');
  });

  it('handles a string that is entirely a math span', () => {
    expect(escapeLatexOutsideMath('$x^2$')).toBe('$x^2$');
  });
});
