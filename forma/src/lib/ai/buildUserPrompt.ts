import type { Country } from '../constants';

export interface WorksheetPromptParams {
  studentName: string;
  country: Country;
  curriculumLevel: string;
  yearLevel: string;
  subjectHint: string[];
  sessionNotes: string;
  topicPrompt: string;
}

export function buildUserPrompt(params: WorksheetPromptParams): string {
  const subjectHint = params.subjectHint.length > 0 ? params.subjectHint.join(', ') : 'not specified';

  return `Student name: ${params.studentName}
Country: ${params.country}
Curriculum level: ${params.curriculumLevel}
Year or grade: ${params.yearLevel}
Subject hint: ${subjectHint}
Recent session notes: ${params.sessionNotes}
Topic to practice: ${params.topicPrompt}
Question structure:
2 warm-up (slightly below level - builds confidence)
6 core (at level - targets the described weakness directly)
2 challenge (above level - clearly labelled, students expect it to be harder)
Include coloured diagrams wherever they help understanding.
In alignment_note write one sentence confirming suitability, naming the exam
board where relevant (England only - Ontario and US do not have exam boards
in this sense). Return only the JSON object.`;
}
