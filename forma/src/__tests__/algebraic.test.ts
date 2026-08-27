import { describe, expect, it } from 'vitest';
import { algebraicEquivalent, MAX_EXPRESSION_LENGTH } from '@/lib/marking/algebraic';

describe('algebraicEquivalent - plain expressions', () => {
  it('recognises 2(x+3) === 2x+6', () => {
    expect(algebraicEquivalent('2*(x+3)', '2x+6')).toBe(true);
    expect(algebraicEquivalent('2(x+3)', '2x+6')).toBe(true);
  });

  it('recognises commutative ordering 3+x === x+3', () => {
    expect(algebraicEquivalent('x+3', '3+x')).toBe(true);
  });

  it('recognises expanded vs factorised (x+2)(x-3) === x^2 - x - 6', () => {
    expect(algebraicEquivalent('(x+2)*(x-3)', 'x^2 - x - 6')).toBe(true);
  });

  it('recognises (x-2)^2 === x^2 - 4x + 4', () => {
    expect(algebraicEquivalent('(x-2)^2', 'x^2-4x+4')).toBe(true);
  });

  it('recognises x/2 === 0.5*x', () => {
    expect(algebraicEquivalent('x/2', '0.5*x')).toBe(true);
  });

  it('rejects genuinely different expressions', () => {
    expect(algebraicEquivalent('2x+6', '5x+6')).toBe(false);
    expect(algebraicEquivalent('x+1', 'x+2')).toBe(false);
  });

  it('rejects the negated form of a plain expression (x+3 vs -x-3)', () => {
    expect(algebraicEquivalent('x+3', '-x-3')).toBe(false);
  });
});

describe('algebraicEquivalent - equations', () => {
  it('recognises 3 = x as the same relation as x = 3', () => {
    expect(algebraicEquivalent('x = 3', '3 = x')).toBe(true);
  });

  it('recognises 2x + 6 = 0 === 2(x+3) = 0', () => {
    expect(algebraicEquivalent('2x+6=0', '2(x+3)=0')).toBe(true);
  });

  it('rejects a genuinely different equation', () => {
    expect(algebraicEquivalent('x = 3', 'x = 4')).toBe(false);
  });
});

describe('algebraicEquivalent - safety and fall-through', () => {
  it('returns false for a blank answer', () => {
    expect(algebraicEquivalent('2x+6', '')).toBe(false);
  });

  it('treats prose (implicit-variable parsing) as a wrong answer, not a crash', () => {
    expect(algebraicEquivalent('2x+6', 'I think it is six')).toBe(false);
  });

  it('returns null for genuinely malformed (unparseable) maths input', () => {
    expect(algebraicEquivalent('2x+6', '2x + (')).toBeNull();
    expect(algebraicEquivalent('2x+6', 'x^')).toBeNull();
  });

  it('returns null for oversize input instead of attempting a slow comparison', () => {
    const big = 'x'.repeat(MAX_EXPRESSION_LENGTH + 1);
    expect(algebraicEquivalent('2x+6', big)).toBeNull();
  });
});
