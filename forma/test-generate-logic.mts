import { buildUserPrompt } from './src/lib/ai/buildUserPrompt';
import { validateWorksheet, type GeneratedWorksheet } from './src/lib/ai/schema';
import { splitMarkScheme } from './src/lib/ai/splitMarkScheme';
import { stripHtmlTags } from './src/lib/ai/sanitize';
import { generateDigitalCode } from './src/lib/utils/digitalCode';

console.log('--- buildUserPrompt ---');
console.log(
  buildUserPrompt({
    studentName: 'Naeto',
    country: 'england',
    curriculumLevel: 'KS3',
    yearLevel: 'Year 9',
    subjectHint: ['Mathematics', 'Physics'],
    sessionNotes: 'none',
    topicPrompt: 'Naeto struggles with adding fractions with different denominators',
  })
);

console.log('\n--- stripHtmlTags ---');
console.log(stripHtmlTags('Fractions <script>alert(1)</script> and <b>bold</b> text'));

console.log('\n--- generateDigitalCode ---');
console.log(generateDigitalCode(), generateDigitalCode());

function makePart(label: string | null, text: string) {
  return {
    part_label: label,
    text,
    marks: 2,
    diagram_spec: null,
    working_lines: 4,
    answer: '3/4',
    answer_format: 'extended' as const,
    mark_scheme: { M1: 'method', A1: 'accuracy', common_error: 'wrong denominator', allow: 'equivalent fractions' },
  };
}

const sample: GeneratedWorksheet = {
  subject: 'Mathematics',
  topic: 'Adding fractions with different denominators',
  curriculum: 'KS3',
  year_level: 'Year 9',
  difficulty_overall: 'standard',
  alignment_note: 'Suitable for Year 9 KS3 Mathematics.',
  questions: [
    { id: 'q1', type: 'warm-up', sub_skill: 'common denominators', parts: [makePart(null, 'Warm up 1')] },
    { id: 'q2', type: 'warm-up', sub_skill: 'common denominators', parts: [makePart(null, 'Warm up 2')] },
    { id: 'q3', type: 'core', sub_skill: 'common denominators', parts: [makePart(null, 'Core 1')] },
    { id: 'q4', type: 'core', sub_skill: 'mixed numbers', parts: [makePart(null, 'Core 2')] },
    { id: 'q5', type: 'core', sub_skill: 'mixed numbers', parts: [makePart(null, 'Core 3')] },
    { id: 'q6', type: 'core', sub_skill: 'word problems', parts: [makePart(null, 'Core 4')] },
    { id: 'q7', type: 'core', sub_skill: 'word problems', parts: [makePart(null, 'Core 5')] },
    { id: 'q8', type: 'core', sub_skill: 'word problems', parts: [makePart(null, 'Core 6')] },
    { id: 'q9', type: 'challenge', sub_skill: 'word problems', parts: [makePart(null, 'Challenge 1')] },
    { id: 'q10', type: 'challenge', sub_skill: 'word problems', parts: [makePart(null, 'Challenge 2')] },
  ],
};

console.log('\n--- validateWorksheet (valid input) ---');
const validated = validateWorksheet(sample);
console.log('OK, subject =', validated.subject);

console.log('\n--- validateWorksheet (wrong question count) ---');
try {
  validateWorksheet({ ...sample, questions: sample.questions.slice(0, 5) });
  console.log('FAIL - should have thrown');
} catch (e) {
  console.log('Correctly threw:', (e as Error).message);
}

console.log('\n--- validateWorksheet (wrong order) ---');
try {
  const badOrder = { ...sample, questions: [...sample.questions] };
  badOrder.questions[0] = { ...badOrder.questions[0], type: 'core' };
  validateWorksheet(badOrder);
  console.log('FAIL - should have thrown');
} catch (e) {
  console.log('Correctly threw:', (e as Error).message);
}

console.log('\n--- splitMarkScheme ---');
const { questionsJson, markSchemeJson } = splitMarkScheme(sample);
console.log('questionsJson.questions[0].parts[0] has mark_scheme key?', 'mark_scheme' in (questionsJson.questions[0].parts[0] as object));
console.log('markSchemeJson.questions[0].parts[0] =', JSON.stringify(markSchemeJson.questions[0].parts[0]));
