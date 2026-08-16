import {
  SUBJECTS,
  CURRICULUM_LEVELS,
  DIFFICULTY_LEVELS,
  type Subject,
  type CurriculumLevel,
  type DifficultyLevel,
} from '../constants';

export const DIAGRAM_TYPES = [
  'coordinate_grid',
  'triangle',
  'bar_chart',
  'number_line',
  'circle',
  'table',
  'right_angle',
] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export interface DiagramSpec {
  type: DiagramType;
  params: Record<string, unknown>;
}

export interface MarkScheme {
  M1: string;
  A1: string;
  common_error: string;
  allow: string;
}

export interface QuestionPart {
  part_label: string | null;
  text: string;
  marks: number;
  diagram_spec: DiagramSpec | null;
  working_lines: number;
  answer: string;
  mark_scheme: MarkScheme;
}

export type QuestionType = 'warm-up' | 'core' | 'challenge';

export interface Question {
  id: string;
  type: QuestionType;
  parts: QuestionPart[];
}

export interface GeneratedWorksheet {
  subject: Subject;
  topic: string;
  curriculum: CurriculumLevel;
  year_level: string;
  difficulty_overall: DifficultyLevel;
  alignment_note: string;
  questions: Question[];
}

// JSON Schema for output_config.format - see the Structured Outputs
// limitations in the Claude API docs: no minItems/maxItems or numeric
// constraints are supported, so exact question count/order is checked
// separately in validateWorksheet below.
export const WORKSHEET_JSON_SCHEMA = {
  type: 'object',
  properties: {
    subject: { type: 'string', enum: [...SUBJECTS] },
    topic: { type: 'string' },
    curriculum: { type: 'string', enum: [...CURRICULUM_LEVELS] },
    year_level: { type: 'string' },
    difficulty_overall: { type: 'string', enum: [...DIFFICULTY_LEVELS] },
    alignment_note: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['warm-up', 'core', 'challenge'] },
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                part_label: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                text: { type: 'string' },
                marks: { type: 'integer' },
                diagram_spec: {
                  anyOf: [
                    { type: 'null' },
                    {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: [...DIAGRAM_TYPES] },
                        params: { type: 'object' },
                      },
                      required: ['type', 'params'],
                      additionalProperties: false,
                    },
                  ],
                },
                working_lines: { type: 'integer' },
                answer: { type: 'string' },
                mark_scheme: {
                  type: 'object',
                  properties: {
                    M1: { type: 'string' },
                    A1: { type: 'string' },
                    common_error: { type: 'string' },
                    allow: { type: 'string' },
                  },
                  required: ['M1', 'A1', 'common_error', 'allow'],
                  additionalProperties: false,
                },
              },
              required: ['part_label', 'text', 'marks', 'diagram_spec', 'working_lines', 'answer', 'mark_scheme'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'type', 'parts'],
        additionalProperties: false,
      },
    },
  },
  required: ['subject', 'topic', 'curriculum', 'year_level', 'difficulty_overall', 'alignment_note', 'questions'],
  additionalProperties: false,
};

const EXPECTED_TYPE_ORDER: QuestionType[] = [
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
];

// Structured outputs already guarantees the shape above; this checks the
// business rules a JSON Schema can't express (exact question count and the
// warm-up/core/challenge order the PDF section dividers depend on).
export function validateWorksheet(data: unknown): GeneratedWorksheet {
  if (typeof data !== 'object' || data === null) {
    throw new Error('AI response was not a JSON object.');
  }
  const worksheet = data as GeneratedWorksheet;

  if (!Array.isArray(worksheet.questions) || worksheet.questions.length !== 10) {
    throw new Error(`Expected exactly 10 questions, got ${Array.isArray(worksheet.questions) ? worksheet.questions.length : 'none'}.`);
  }

  worksheet.questions.forEach((question, i) => {
    if (question.type !== EXPECTED_TYPE_ORDER[i]) {
      throw new Error(`Question ${i + 1} should be "${EXPECTED_TYPE_ORDER[i]}", got "${question.type}".`);
    }
    if (!Array.isArray(question.parts) || question.parts.length === 0) {
      throw new Error(`Question ${i + 1} has no parts.`);
    }
  });

  if (!worksheet.alignment_note || worksheet.alignment_note.trim().length === 0) {
    throw new Error('alignment_note was empty.');
  }

  return worksheet;
}
