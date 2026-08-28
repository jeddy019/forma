import { describe, expect, it } from 'vitest';
import { validateBankRecord, normalizeQuestionText } from '@/lib/questionBank/importValidation';

const validRow = {
  country: 'england',
  curriculum_level: 'GCSE',
  subject: 'Mathematics',
  topic: 'Simultaneous Equations',
  sub_skill: 'elimination method',
  question: {
    text: 'Solve $2x + 3y = 12$.',
    marks: 3,
    answer_format: 'extended',
    answer: '$x = 3$',
    mark_scheme: { M1: 'Eliminates a variable.', A1: '$x = 3$' },
  },
};

describe('validateBankRecord', () => {
  it('accepts a fully valid record and normalizes it', () => {
    const result = validateBankRecord(validRow, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.country).toBe('england');
    expect(result.record.subject).toBe('Mathematics');
    expect(result.record.exam_board).toBeNull();
    expect(result.record.question.marks).toBe(3);
  });

  it('marks exam_board invalid for its country', () => {
    const result = validateBankRecord({ ...validRow, exam_board: 'SAT' }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('exam board "SAT" is not valid for england');
  });

  it('accepts a board that belongs to the country', () => {
    const result = validateBankRecord({ ...validRow, exam_board: 'AQA' }, 0);
    expect(result.ok).toBe(true);
  });

  it('rejects a non-array object and missing fields with row numbers', () => {
    expect(validateBankRecord(null, 4).ok).toBe(false);
    const missingCountry = validateBankRecord({ ...validRow, country: '' }, 4);
    expect(missingCountry.ok).toBe(false);
    if (!missingCountry.ok) expect(missingCountry.error).toContain('row 5');
  });

  it('rejects an invalid subject and invalid answer_format', () => {
    const badSubject = validateBankRecord({ ...validRow, subject: 'Rocket Science' }, 0);
    expect(badSubject.ok).toBe(false);

    const badFormat = validateBankRecord(
      { ...validRow, question: { ...validRow.question, answer_format: 'essay' } },
      0
    );
    expect(badFormat.ok).toBe(false);
  });

  it('rejects marks outside 1-20 and a missing answer', () => {
    const badMarks = validateBankRecord({ ...validRow, question: { ...validRow.question, marks: 0 } }, 0);
    expect(badMarks.ok).toBe(false);

    const missingAnswer = validateBankRecord({ ...validRow, question: { ...validRow.question, answer: '' } }, 0);
    expect(missingAnswer.ok).toBe(false);
  });

  it('requires M1 and A1 but tolerates optional mark-scheme fields', () => {
    const noM1 = validateBankRecord({ ...validRow, question: { ...validRow.question, mark_scheme: { A1: 'x' } } }, 0);
    expect(noM1.ok).toBe(false);

    const withExtras = validateBankRecord(
      {
        ...validRow,
        question: {
          ...validRow.question,
          mark_scheme: { M1: 'm', A1: 'a', common_error: 'e', allow: 'ok', worked_solution: ['Step one.', '  ', 'Step two.'] },
        },
      },
      0
    );
    expect(withExtras.ok).toBe(true);
    if (withExtras.ok) {
      expect(withExtras.record.question.mark_scheme.worked_solution).toEqual(['Step one.', 'Step two.']);
      expect(withExtras.record.question.mark_scheme.common_error).toBe('e');
    }
  });
});

describe('normalizeQuestionText', () => {
  it('collapses whitespace and case for stable dedupe', () => {
    expect(normalizeQuestionText('  Solve   $x$  ')).toBe(normalizeQuestionText('solve $x$'));
    expect(normalizeQuestionText('Solve $X$')).toBe('solve $x$');
  });
});