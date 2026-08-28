import { COUNTRIES, SUBJECTS, EXAM_BOARDS_BY_COUNTRY, type Country, type Subject } from '@/lib/constants';
import { ANSWER_FORMATS, type AnswerFormat } from '@/lib/ai/schema';

// Phase B Wave 4 Step 69: shared validation for the question bank import
// pipeline. The bulk-import server action (admin/question-bank/import) runs
// every incoming record through validateBankRecord before inserting, so no
// malformed row can reach question_bank and the extraction pipeline (Wave 6)
// has a single documented contract to emit against - see
// question-bank-import.example.json at the repo root for a filled-in sample.

export interface ImportBankMarkScheme {
  M1: string;
  A1: string;
  common_error?: string | null;
  allow?: string | null;
  worked_solution?: string[];
}

export interface ImportBankQuestion {
  text: string;
  marks: number;
  answer_format: AnswerFormat;
  answer: string;
  mark_scheme: ImportBankMarkScheme;
}

export interface ImportBankRecord {
  country: Country;
  curriculum_level: string;
  subject: Subject;
  topic: string;
  sub_skill: string | null;
  exam_board: string | null;
  question: ImportBankQuestion;
}

export type ImportValidationResult =
  | { ok: true; record: ImportBankRecord }
  | { ok: false; error: string };

export const MAX_IMPORT_ROWS = 1000;
export const IMPORT_BATCH_SIZE = 100;
export const IMPORT_TEXT_MAX_CHARACTERS = 1_500_000;

const TEXT_MAX_LENGTH = 2000;
const MARKS_MIN = 1;
const MARKS_MAX = 20;
const SUB_SKILL_MAX_LENGTH = 120;
const TOPIC_MAX_LENGTH = 120;
const CURRICULUM_MAX_LENGTH = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

// Dedupe key: trimmed, whitespace-collapsed, lowercased question text. Safe
// to hold in memory as a Set key - no hashing needed.
export function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// index is 0-based; row numbers in error messages are 1-based for humans.
export function validateBankRecord(raw: unknown, index: number): ImportValidationResult {
  const where = `row ${index + 1}`;
  if (!isRecord(raw)) return { ok: false, error: `${where}: not an object` };

  const country = str(raw.country);
  if (!country || !COUNTRIES.includes(country as Country)) {
    return { ok: false, error: `${where}: invalid country "${country ?? ''}"` };
  }

  const curriculum_level = str(raw.curriculum_level);
  if (!curriculum_level) return { ok: false, error: `${where}: curriculum_level is required` };
  if (curriculum_level.length > CURRICULUM_MAX_LENGTH) return { ok: false, error: `${where}: curriculum_level too long` };

  const subject = str(raw.subject);
  if (!subject || !SUBJECTS.includes(subject as Subject)) {
    return { ok: false, error: `${where}: invalid subject "${subject ?? ''}"` };
  }

  const topic = str(raw.topic);
  if (!topic) return { ok: false, error: `${where}: topic is required` };
  if (topic.length > TOPIC_MAX_LENGTH) return { ok: false, error: `${where}: topic too long` };

  const sub_skill = str(raw.sub_skill ?? null) ?? null;
  if (sub_skill && sub_skill.length > SUB_SKILL_MAX_LENGTH) {
    return { ok: false, error: `${where}: sub_skill too long` };
  }

  const exam_board = str(raw.exam_board ?? null) ?? null;
  if (exam_board) {
    const boards = EXAM_BOARDS_BY_COUNTRY[country as Country];
    if (!boards.includes(exam_board)) {
      return { ok: false, error: `${where}: exam board "${exam_board}" is not valid for ${country}` };
    }
  }

  if (!isRecord(raw.question)) return { ok: false, error: `${where}: "question" is required` };
  const q = raw.question;

  const text = str(q.text);
  if (!text) return { ok: false, error: `${where}: question.text is required` };
  if (text.length > TEXT_MAX_LENGTH) return { ok: false, error: `${where}: question.text must be ${TEXT_MAX_LENGTH} characters or fewer` };

  const marks = Number(q.marks);
  if (!Number.isInteger(marks) || marks < MARKS_MIN || marks > MARKS_MAX) {
    return { ok: false, error: `${where}: marks must be a whole number between ${MARKS_MIN} and ${MARKS_MAX}` };
  }

  const answer_format = str(q.answer_format);
  if (!answer_format || !ANSWER_FORMATS.includes(answer_format as AnswerFormat)) {
    return { ok: false, error: `${where}: invalid answer_format "${answer_format ?? ''}"` };
  }

  const answer = str(q.answer);
  if (!answer) return { ok: false, error: `${where}: question.answer is required` };

  if (!isRecord(q.mark_scheme)) return { ok: false, error: `${where}: question.mark_scheme is required` };
  const ms = q.mark_scheme;
  const M1 = str(ms.M1);
  const A1 = str(ms.A1);
  if (!M1 || !A1) return { ok: false, error: `${where}: mark_scheme M1 and A1 are required` };
  const common_error = str(ms.common_error ?? null) ?? null;
  const allow = str(ms.allow ?? null) ?? null;
  const worked_solution = Array.isArray(ms.worked_solution)
    ? ms.worked_solution.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
    : undefined;

  return {
    ok: true,
    record: {
      country: country as Country,
      curriculum_level,
      subject: subject as Subject,
      topic,
      sub_skill,
      exam_board,
      question: {
        text,
        marks,
        answer_format: answer_format as AnswerFormat,
        answer,
        mark_scheme: {
          M1,
          A1,
          common_error,
          allow,
          ...(worked_solution && worked_solution.length > 0 ? { worked_solution } : {}),
        },
      },
    },
  };
}