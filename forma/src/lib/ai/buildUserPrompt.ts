import type { Country } from '../constants';

export interface WorksheetPromptParams {
  studentName: string;
  country: Country;
  curriculumLevel: string;
  yearLevel: string;
  subjectHint: string[];
  sessionNotes: string;
  topicPrompt: string;
  // Phase 7 Step 40 (Daily practice mode): defaults to the standard
  // 10-question worksheet. 5 selects the daily variant's question-structure
  // text below - callers also need to pass DAILY_TYPE_ORDER to
  // generateWorksheet/validateWorksheet separately (schema.ts), this only
  // controls the prose the model reads.
  questionCount?: 5 | 10;
  // Phase 7 Steps 40/41 shared mechanism: when present, appended as its own
  // paragraph instructing the model to target one specific sub-skill
  // instead of freely decomposing the topic - Step 40 (explicit tutor pick)
  // and Step 41 (return-to-fundamentals routing) both build different text
  // for this same field, never both at once (see the two generation
  // routes).
  subSkillDirective?: string;
}

export function buildUserPrompt(params: WorksheetPromptParams): string {
  const subjectHint = params.subjectHint.length > 0 ? params.subjectHint.join(', ') : 'not specified';
  const questionCount = params.questionCount ?? 10;

  const questionStructure =
    questionCount === 5
      ? `Question structure:
5 core questions, all targeting the same single sub-skill - a short,
focused daily practice set, not a full topic decomposition.`
      : `Question structure:
2 warm-up (slightly below level - builds confidence)
6 core (at level - targets the described weakness directly)
2 challenge (above level - clearly labelled, students expect it to be harder)`;

  const subSkillDirectiveText = params.subSkillDirective ? `\n${params.subSkillDirective}` : '';

  return `Student name: ${params.studentName}
Country: ${params.country}
Curriculum level: ${params.curriculumLevel}
Year or grade: ${params.yearLevel}
Subject hint: ${subjectHint}
Recent session notes: ${params.sessionNotes}
Topic to practice: ${params.topicPrompt}
${questionStructure}
Include coloured diagrams wherever they help understanding.
In alignment_note write one sentence confirming suitability, naming the exam
board where relevant (England only - Ontario and US do not have exam boards
in this sense).${subSkillDirectiveText}
Return only the JSON object.`;
}
