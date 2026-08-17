import { describe, expect, it } from 'vitest';
import { nextDifficulty } from '@/lib/adaptive/nextDifficulty';

describe('nextDifficulty', () => {
  it('upgrades one level above 80%', () => {
    expect(nextDifficulty('foundation', 85)).toBe('standard');
    expect(nextDifficulty('standard', 85)).toBe('higher');
  });

  it('does not upgrade past the top level', () => {
    expect(nextDifficulty('higher', 100)).toBeNull();
  });

  it('downgrades one level below 50%', () => {
    expect(nextDifficulty('higher', 45)).toBe('standard');
    expect(nextDifficulty('standard', 45)).toBe('foundation');
  });

  it('does not downgrade past the bottom level', () => {
    expect(nextDifficulty('foundation', 0)).toBeNull();
  });

  it('does not change exactly at the 80% boundary', () => {
    expect(nextDifficulty('standard', 80)).toBeNull();
  });

  it('does not change exactly at the 50% boundary', () => {
    expect(nextDifficulty('standard', 50)).toBeNull();
  });

  it('changes just past each boundary', () => {
    expect(nextDifficulty('standard', 81)).toBe('higher');
    expect(nextDifficulty('standard', 49)).toBe('foundation');
  });

  it('does not change in the middle of the band', () => {
    expect(nextDifficulty('standard', 65)).toBeNull();
  });
});
