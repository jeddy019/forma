import { describe, expect, it } from 'vitest';
import { blendWithBank } from '@/lib/questionBank/blendWithBank';
import type { GeneratedWorksheet } from '@/lib/ai/schema';
import type { BankRow } from '@/lib/questionBank/pullVerifiedQuestions';

function makePart(text = 'ai text') {
  return {
    part_label: null,
    text,
    marks: 2,
    diagram_spec: null,
    working_lines: 4,
    answer: 'ai answer',
    answer_format: 'numerical' as const,
    mark_scheme: { M1: 'ai m1', A1: 'ai a1', common_error: 'ai err', allow: 'ai allow' },
  };
}

function makeWorksheet(): GeneratedWorksheet {
  return {
    subject: 'Mathematics',
    topic: 'Simultaneous equations',
    curriculum: 'KS3',
    year_level: 'Year 9',
    difficulty_overall: 'standard',
    alignment_note: 'note',
    questions: [
      { id: 'q1', type: 'warm-up', sub_skill: 'elimination method', parts: [makePart()] },
      { id: 'q2', type: 'core', sub_skill: 'word problems', parts: [makePart()] },
    ],
  };
}

function makeBankRow(id: string, subSkill: string): BankRow {
  return {
    id,
    sub_skill: subSkill,
    question_json: {
      text: 'bank text',
      marks: 3,
      answer_format: 'extended',
      answer: 'bank answer',
      mark_scheme: { M1: 'bank m1', A1: 'bank a1', common_error: 'bank err', allow: 'bank allow' },
    },
  };
}

describe('blendWithBank', () => {
  it('replaces a matching-slug question with the bank content', () => {
    const worksheet = makeWorksheet();
    const result = blendWithBank(worksheet, [makeBankRow('b1', 'Elimination Method')]);

    const q1 = result.worksheet.questions[0];
    expect(q1.parts).toHaveLength(1);
    expect(q1.parts[0].text).toBe('bank text');
    expect(q1.parts[0].marks).toBe(3);
    expect(q1.parts[0].answer).toBe('bank answer');
    expect(result.bankQuestionIdsUsed).toEqual(['b1']);
  });

  it('leaves non-matching questions untouched', () => {
    const worksheet = makeWorksheet();
    const result = blendWithBank(worksheet, [makeBankRow('b1', 'elimination method')]);

    const q2 = result.worksheet.questions[1];
    expect(q2.parts[0].text).toBe('ai text');
  });

  it('preserves the AI question id/type/sub_skill on a swapped question', () => {
    const worksheet = makeWorksheet();
    const result = blendWithBank(worksheet, [makeBankRow('b1', 'elimination method')]);

    const q1 = result.worksheet.questions[0];
    expect(q1.id).toBe('q1');
    expect(q1.type).toBe('warm-up');
    expect(q1.sub_skill).toBe('elimination method');
  });

  it('is a no-op on an empty bank', () => {
    const worksheet = makeWorksheet();
    const result = blendWithBank(worksheet, []);
    expect(result.worksheet).toEqual(worksheet);
    expect(result.bankQuestionIdsUsed).toEqual([]);
  });

  it('is deterministic with a fixed injected rng', () => {
    const worksheet = makeWorksheet();
    const rows = [makeBankRow('b1', 'elimination method'), makeBankRow('b2', 'elimination method')];
    const result = blendWithBank(worksheet, rows, () => 0.99);
    expect(result.bankQuestionIdsUsed).toEqual(['b2']);
  });

  it('matches regardless of casing/whitespace differences via slugification', () => {
    const worksheet = makeWorksheet();
    const result = blendWithBank(worksheet, [makeBankRow('b1', '  Elimination Method  ')]);
    expect(result.worksheet.questions[0].parts[0].text).toBe('bank text');
  });
});
