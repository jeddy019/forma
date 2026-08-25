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
  'pie_chart',
] as const;
export type DiagramType = (typeof DIAGRAM_TYPES)[number];

export interface DiagramSpec {
  type: DiagramType;
  // A JSON-encoded string, not a nested object - see the comment above
  // DIAGRAM_SPEC_SCHEMA for why. Parsed defensively at render time in
  // worksheet-template.ts's renderDiagramSvg.
  params: string;
}

export interface MarkScheme {
  M1: string;
  A1: string;
  common_error: string;
  allow: string;
}

// Marking Logic (CLAUDE.md): Tier 1 auto-marks numerical, coordinates,
// true/false, and multiple choice answers instantly on submission via exact
// match with normalisation (Tier 1's own comparison logic, not this list,
// decides case/whitespace/decimal-tolerance rules - see
// src/lib/marking/tier1.ts). "extended" covers anything needing shown
// working, an explanation, or a proof - those fall through to Tier 2
// (AI-assisted) or Tier 3 (tutor review), neither built yet. Added in Phase
// 3 Step 16 - the schema had no way to distinguish these before, so Tier 1
// would have had nothing reliable to key off.
export const ANSWER_FORMATS = ['numerical', 'coordinates', 'true_false', 'multiple_choice', 'extended'] as const;
export type AnswerFormat = (typeof ANSWER_FORMATS)[number];

export interface QuestionPart {
  part_label: string | null;
  text: string;
  marks: number;
  diagram_spec: DiagramSpec | null;
  working_lines: number;
  answer: string;
  answer_format: AnswerFormat;
  mark_scheme: MarkScheme;
}

export type QuestionType = 'warm-up' | 'core' | 'challenge';

export interface Question {
  id: string;
  type: QuestionType;
  // Phase 7 Step 37 (Zero to Mastery): which component sub-skill of the
  // topic this question targets (e.g. "elimination method" within
  // simultaneous equations) - see systemPrompt.ts's decomposition
  // instruction. Required, not nullable: unlike diagram_spec, there is no
  // legitimate "no sub-skill" case - every question is deliberately
  // decomposed by design. A plain string leaf, same cost as `topic`/`id`
  // against the schema's documented nullable/union-node cap (see
  // DIAGRAM_SPEC_SCHEMA's comment below) - adds zero.
  sub_skill: string;
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

// Structured Outputs requires every object-level schema node to explicitly
// set additionalProperties: false (confirmed live: the API rejected the
// once-bare `params: { type: 'object' }` with "For 'object' type,
// 'additionalProperties' must be explicitly set to false"). The natural fix -
// a 7-way anyOf branch per DIAGRAM_TYPES member, each with its own params
// shape - was tried next and rejected too: repeated inside every question
// part across 10 questions, it compiled to a grammar the API refused as too
// large ("Simplify your tool schemas or reduce the number of strict tools").
// A single flat params object covering every diagram type's fields (all
// nullable, so any one diagram only fills in the fields it needs) was tried
// third and rejected for a different reason: the API caps a schema at 16
// total union/nullable-typed parameters ("Reduce the number of nullable or
// union-typed parameters"), and that object alone needed ~25.
//
// params is therefore a plain JSON-encoded string, opaque to the schema
// (just `{ type: 'string' }`, no union, no nested object) - the model writes
// an actual JSON object as text into it, following the per-type field list
// documented in WORKSHEET_SYSTEM_PROMPT (systemPrompt.ts) rather than an
// enforced schema. worksheet-template.ts's renderDiagramSvg JSON.parses it
// inside its existing try/catch, so a malformed string degrades to "no
// diagram" the same way a malformed object already did.
const DIAGRAM_SPEC_SCHEMA = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...DIAGRAM_TYPES] },
        params: { type: 'string' },
      },
      required: ['type', 'params'],
      additionalProperties: false,
    },
  ],
};

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
          sub_skill: { type: 'string' },
          parts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                part_label: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                text: { type: 'string' },
                marks: { type: 'integer' },
                diagram_spec: DIAGRAM_SPEC_SCHEMA,
                working_lines: { type: 'integer' },
                answer: { type: 'string' },
                answer_format: { type: 'string', enum: [...ANSWER_FORMATS] },
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
              required: ['part_label', 'text', 'marks', 'diagram_spec', 'working_lines', 'answer', 'answer_format', 'mark_scheme'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'type', 'sub_skill', 'parts'],
        additionalProperties: false,
      },
    },
  },
  required: ['subject', 'topic', 'curriculum', 'year_level', 'difficulty_overall', 'alignment_note', 'questions'],
  additionalProperties: false,
};

// Exported so generateWorksheet.ts can pass it through as validateWorksheet's
// default (see below) and so it's usable as an explicit reference value -
// not just for internal use anymore now that DAILY_TYPE_ORDER exists
// alongside it.
export const EXPECTED_TYPE_ORDER: QuestionType[] = [
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

// Phase 7 Step 40 (Daily practice mode): 5 questions, all "core" - no
// warm-up/challenge tiering. CLAUDE.md's own daily-mode principle ("5
// questions on a single sub-skill... short, focused") never mentions
// tiering the way the main worksheet's structure explicitly does, so this
// doesn't invent a proportional split it wasn't asked for.
export const DAILY_TYPE_ORDER: QuestionType[] = ['core', 'core', 'core', 'core', 'core'];

// Postgres TEXT columns reject NUL bytes outright (error 22P05, found live
// 2026-08-24: a real generation stored \u0000 inside questions_json and the
// insert failed AFTER the paid AI call had already succeeded), and the other
// C0 control characters render as garbage in HTML/PDF output. Models
// occasionally emit literal \u0000 escapes inside string values, so every
// string in the parsed response is scrubbed here - at the single choke point
// both AI paths flow through - before anything downstream (DB insert, PDF
// renderer, digital page) ever sees it. \n, \r, \t are deliberately kept.
const UNSAFE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function deepSanitizeStrings<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(UNSAFE_CONTROL_CHARS, '') as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map(deepSanitizeStrings) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, deepSanitizeStrings(entry)])
    ) as unknown as T;
  }
  return value;
}

// Structured outputs already guarantees the shape above; this checks the
// business rules a JSON Schema can't express (exact question count and the
// warm-up/core/challenge order the PDF section dividers depend on).
// expectedTypeOrder defaults to the standard 10-question worksheet shape;
// callers building a daily practice worksheet (Step 40) pass
// DAILY_TYPE_ORDER instead - one validator, parameterized, rather than a
// forked duplicate.
export function validateWorksheet(data: unknown, expectedTypeOrder: QuestionType[] = EXPECTED_TYPE_ORDER): GeneratedWorksheet {
  if (typeof data !== 'object' || data === null) {
    throw new Error('AI response was not a JSON object.');
  }
  const worksheet = deepSanitizeStrings(data) as GeneratedWorksheet;

  if (!Array.isArray(worksheet.questions) || worksheet.questions.length !== expectedTypeOrder.length) {
    throw new Error(
      `Expected exactly ${expectedTypeOrder.length} questions, got ${Array.isArray(worksheet.questions) ? worksheet.questions.length : 'none'}.`
    );
  }

  worksheet.questions.forEach((question, i) => {
    if (question.type !== expectedTypeOrder[i]) {
      throw new Error(`Question ${i + 1} should be "${expectedTypeOrder[i]}", got "${question.type}".`);
    }
    if (!Array.isArray(question.parts) || question.parts.length === 0) {
      throw new Error(`Question ${i + 1} has no parts.`);
    }
    // Structured Outputs guarantees sub_skill is a string, not that it's
    // meaningful - same defensive non-empty check as alignment_note below.
    if (!question.sub_skill || question.sub_skill.trim().length === 0) {
      throw new Error(`Question ${i + 1} has an empty sub_skill.`);
    }
  });

  if (!worksheet.alignment_note || worksheet.alignment_note.trim().length === 0) {
    throw new Error('alignment_note was empty.');
  }

  return worksheet;
}
