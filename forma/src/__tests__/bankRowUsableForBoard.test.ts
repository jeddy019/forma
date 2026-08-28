import { describe, expect, it } from 'vitest';
import { bankRowUsableForBoard } from '@/lib/questionBank/pullVerifiedQuestions';

// B68: the row-level rule behind pullVerifiedQuestions' board filtering. A
// board-agnostic row (NULL) is eligible for everyone; a tagged row only for
// its own board; no pinned board accepts everything (pre-B68 behaviour).
describe('bankRowUsableForBoard', () => {
  it('accepts any row when no board is pinned', () => {
    expect(bankRowUsableForBoard(null, null)).toBe(true);
    expect(bankRowUsableForBoard('AQA', null)).toBe(true);
    expect(bankRowUsableForBoard('Edexcel', undefined)).toBe(true);
  });

  it('accepts board-agnostic rows for a board-pinned student', () => {
    expect(bankRowUsableForBoard(null, 'AQA')).toBe(true);
    expect(bankRowUsableForBoard(null, 'SAT')).toBe(true);
  });

  it('accepts a row tagged with exactly the pinned board', () => {
    expect(bankRowUsableForBoard('AQA', 'AQA')).toBe(true);
    expect(bankRowUsableForBoard('SAT', 'SAT')).toBe(true);
  });

  it('rejects a row from a different board than the pinned one', () => {
    expect(bankRowUsableForBoard('Edexcel', 'AQA')).toBe(false);
    expect(bankRowUsableForBoard('AQA', 'OCR')).toBe(false);
    expect(bankRowUsableForBoard('ACT', 'SAT')).toBe(false);
  });
});