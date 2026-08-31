import { describe, expect, it } from 'vitest';
import { buildUserPrompt } from '@/lib/ai/buildUserPrompt';
import type { Country } from '@/lib/constants';

const base = {
  studentName: 'Aisha',
  country: 'england' as Country,
  curriculumLevel: 'GCSE',
  yearLevel: 'Year 10',
  subjectHint: ['Mathematics'],
  sessionNotes: 'none',
  topicPrompt: 'Simultaneous equations',
};

describe('buildUserPrompt', () => {
  it('uses the standard 10-question structure by default', () => {
    const prompt = buildUserPrompt(base);
    expect(prompt).toContain('2 warm-up');
    expect(prompt).toContain('6 core');
    expect(prompt).toContain('2 challenge');
    expect(prompt).not.toContain('focus');
    expect(prompt).toContain('Simultaneous equations');
  });

  it('emits the focused re-practice structure with exact sub-skill names when focusSubSkills is set', () => {
    const prompt = buildUserPrompt({
      ...base,
      focusSubSkills: ['elimination method', 'word problems'],
    });
    expect(prompt).toContain('5 questions, each on ONE of these exact sub-skills only');
    expect(prompt).toContain('- elimination method');
    expect(prompt).toContain('- word problems');
    expect(prompt).toContain("that question's sub_skill to that exact name");
    // Focus mode must not fall back to the warm-up/core/challenge wording.
    expect(prompt).not.toContain('6 core');
    expect(prompt).not.toContain('2 warm-up');
  });

  it('switches to the single-sub-skill 5-question structure when questionCount is 5 (daily mode)', () => {
    const prompt = buildUserPrompt({ ...base, questionCount: 5 });
    expect(prompt).toContain('5 core questions, all targeting the same single sub-skill');
    expect(prompt).not.toContain('6 core');
  });

  it('appends an independent subSkillDirective as its own paragraph', () => {
    const prompt = buildUserPrompt({
      ...base,
      subSkillDirective: 'Write every question on the prerequisite for "elimination method".',
    });
    expect(prompt).toContain('Write every question on the prerequisite for "elimination method".');
  });

  it('emits the exam board line when examBoard is set (B67)', () => {
    const prompt = buildUserPrompt({ ...base, examBoard: 'AQA' });
    expect(prompt).toContain('Exam board: AQA');
    expect(prompt.indexOf('Exam board: AQA')).toBeLessThan(prompt.indexOf('Subject hint:'));
  });

  it('omits any exam board line when none is picked', () => {
    const prompt = buildUserPrompt({ ...base, examBoard: undefined });
    expect(prompt).not.toContain('Exam board');
  });

  it('emits the high-intensity cram board structure with the focus sub-skills (B75)', () => {
    const prompt = buildUserPrompt({
      ...base,
      cramStyle: true,
      questionCount: 20,
      focusSubSkills: ['elimination method', 'quadratic equations'],
    });
    expect(prompt).toContain('20 mixed core questions');
    expect(prompt).toContain('high-intensity exam-week set');
    expect(prompt).toContain('warm-up, no challenge');
    expect(prompt).toContain('- elimination method');
    expect(prompt).toContain('- quadratic equations');
    expect(prompt).toContain("Set each question's sub_skill to exactly one of the listed names");
    // Cram is all-core - it must never fall back to the warm-up/core/challenge
    // or the short-5 focused wording.
    expect(prompt).not.toContain('2 warm-up');
    expect(prompt).not.toContain('6 core');
    expect(prompt).not.toContain('5 questions, each on ONE of these exact sub-skills only');
  });

  it('emits the unique-variant instruction when uniqueVariant is set (B76)', () => {
    const prompt = buildUserPrompt({ ...base, uniqueVariant: true });
    expect(prompt).toContain('generate a DIFFERENT question set');
    expect(prompt).toContain('every student in this assignment must receive distinct questions');
  });

  it('omits the unique-variant instruction by default', () => {
    const prompt = buildUserPrompt({ ...base, uniqueVariant: undefined });
    expect(prompt).not.toContain('Unique variant');
  });
});
