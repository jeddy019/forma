import { describe, expect, it } from 'vitest';
import { resolveQuizShape } from '@/lib/quiz/quizShape';

describe('resolveQuizShape (W5 B75 cram mode)', () => {
  it('defaults the standard worksheet to 10 questions with warm-up/core/challenge order', () => {
    const shape = resolveQuizShape({ generatedFrom: 'quiz' });
    expect(shape.questionCount).toBe(10);
    expect(shape.typeOrder).toEqual([
      'warm-up',
      'warm-up',
      'core',
      'core',
      'core',
      'core',
      'core',
      'core',
      'challenge',
      'challenge',
    ]);
  });

  it('keeps focus sets (re-practice) on the short 5-core board', () => {
    const shape = resolveQuizShape({
      generatedFrom: 're-practice',
      focusSubSkills: ['elimination method', 'word problems'],
    });
    expect(shape.questionCount).toBe(5);
    expect(shape.typeOrder).toEqual(['core', 'core', 'core', 'core', 'core']);
  });

  it('lets a caller override count on a focus set', () => {
    const shape = resolveQuizShape({
      generatedFrom: 're-practice',
      focusSubSkills: ['elimination method'],
      questionCount: 10,
    });
    expect(shape.questionCount).toBe(10);
  });

  it('cram mode defaults to a full 20-core board even when focus-targeted (B75)', () => {
    const shape = resolveQuizShape({
      generatedFrom: 'cram',
      focusSubSkills: ['elimination method', 'quadratic equations', 'fractions'],
    });
    expect(shape.questionCount).toBe(20);
    expect(shape.typeOrder).toHaveLength(20);
    expect(shape.typeOrder.every((t) => t === 'core')).toBe(true);
  });

  it('cram mode honours an explicit questionCount', () => {
    const shape = resolveQuizShape({
      generatedFrom: 'cram',
      focusSubSkills: ['elimination method'],
      questionCount: 15,
    });
    expect(shape.questionCount).toBe(15);
    expect(shape.typeOrder).toHaveLength(15);
  });

  it('daily mode is all-core and follows the dial count', () => {
    const shape = resolveQuizShape({ generatedFrom: 'daily', questionCount: 5 });
    expect(shape.questionCount).toBe(5);
    expect(shape.typeOrder.every((t) => t === 'core')).toBe(true);
  });
});
