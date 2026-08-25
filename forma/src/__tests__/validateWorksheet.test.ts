import { describe, expect, it } from 'vitest';
import { validateWorksheet, EXPECTED_TYPE_ORDER, DAILY_TYPE_ORDER } from '@/lib/ai/schema';
import type { GeneratedWorksheet, QuestionType } from '@/lib/ai/schema';

function makePart() {
  return {
    part_label: null,
    text: 'text',
    marks: 2,
    diagram_spec: null,
    working_lines: 4,
    answer: 'answer',
    answer_format: 'numerical' as const,
    mark_scheme: { M1: 'm1', A1: 'a1', common_error: 'err', allow: 'allow' },
  };
}

function makeWorksheet(typeOrder: QuestionType[], overrides: Partial<{ subSkill: (i: number) => string }> = {}): GeneratedWorksheet {
  const subSkill = overrides.subSkill ?? (() => 'general practice');
  return {
    subject: 'Mathematics',
    topic: 'Test topic',
    curriculum: 'KS3',
    year_level: 'Year 9',
    difficulty_overall: 'standard',
    alignment_note: 'Suitable for Year 9 KS3 Mathematics.',
    questions: typeOrder.map((type, i) => ({ id: `q${i + 1}`, type, sub_skill: subSkill(i), parts: [makePart()] })),
  };
}

describe('validateWorksheet', () => {
  it('accepts a valid default 10-question worksheet', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER);
    expect(() => validateWorksheet(worksheet)).not.toThrow();
  });

  it('rejects a 10-question worksheet with the wrong question count', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER.slice(0, 9));
    expect(() => validateWorksheet(worksheet)).toThrow(/Expected exactly 10 questions/);
  });

  it('rejects a 10-question worksheet with the wrong type order', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER);
    worksheet.questions[0] = { ...worksheet.questions[0], type: 'core' };
    expect(() => validateWorksheet(worksheet)).toThrow(/should be "warm-up"/);
  });

  it('accepts a valid 5-question daily worksheet when DAILY_TYPE_ORDER is passed', () => {
    const worksheet = makeWorksheet(DAILY_TYPE_ORDER);
    expect(() => validateWorksheet(worksheet, DAILY_TYPE_ORDER)).not.toThrow();
  });

  it('rejects a 5-question worksheet validated against the default 10-question order', () => {
    const worksheet = makeWorksheet(DAILY_TYPE_ORDER);
    expect(() => validateWorksheet(worksheet)).toThrow(/Expected exactly 10 questions/);
  });

  it('rejects an empty sub_skill', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER, { subSkill: () => '' });
    expect(() => validateWorksheet(worksheet)).toThrow(/empty sub_skill/);
  });

  it('rejects a whitespace-only sub_skill', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER, { subSkill: () => '   ' });
    expect(() => validateWorksheet(worksheet)).toThrow(/empty sub_skill/);
  });

  it('rejects an empty alignment_note', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER);
    worksheet.alignment_note = '';
    expect(() => validateWorksheet(worksheet)).toThrow(/alignment_note was empty/);
  });

  it('rejects a non-object response', () => {
    expect(() => validateWorksheet(null)).toThrow(/not a JSON object/);
    expect(() => validateWorksheet('a string')).toThrow(/not a JSON object/);
  });

  // Found live 2026-08-24: the model emitted a literal \u0000 inside
  // questions_json; Postgres refused the insert (22P05) after the paid AI
  // call had already succeeded, surfacing as a failed generation. The
  // validator must scrub control characters before anything downstream.
  it('strips NUL and unsafe control characters from every nested string', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER);
    worksheet.questions[0].parts[0].text = 'Solve\u0000 for x';
    worksheet.questions[0].parts[0].mark_scheme.A1 = 'x = 4\u001B';
    (worksheet.questions[0].parts[0].mark_scheme as unknown as Record<string, string>).common_error = 'bad\x00answer';
    const cleaned = validateWorksheet(worksheet);
    expect(cleaned.questions[0].parts[0].text).toBe('Solve for x');
    expect(cleaned.questions[0].parts[0].mark_scheme.A1).toBe('x = 4');
    expect(cleaned.questions[0].parts[0].mark_scheme.common_error).toBe('badanswer');
  });

  it('keeps legitimate whitespace characters while sanitising', () => {
    const worksheet = makeWorksheet(EXPECTED_TYPE_ORDER);
    worksheet.questions[0].parts[0].text = 'line one\nline two\tindented\r\nend';
    const cleaned = validateWorksheet(worksheet);
    expect(cleaned.questions[0].parts[0].text).toBe('line one\nline two\tindented\r\nend');
  });
});
