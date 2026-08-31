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
  // controls the prose the model reads. 15 is W8 Wave D's Deep volume, 20
  // is W5 B75's cram-mode board.
  questionCount?: 5 | 10 | 15 | 20;
  // W8 Wave D (automatic daily quiz): forces the "N core questions, no
  // warm-up, no challenge" prose regardless of count - the daily quiz is
  // never easy-tier and never ends on a labelled challenge. Mirrors the
  // all-core typeOrder the caller must also pass.
  dailyStyle?: boolean;
  // W5 B75 (cram mode): exam-week high-intensity prose - "20 mixed core
  // questions from the student's weak sub-skills, no warm-up, no challenge,
  // timed." Mutually exclusive with dailyStyle (a caller picks one or the
  // other, never both - the all-core typeOrder is passed separately).
  cramStyle?: boolean;
  // Phase 7 Steps 40/41 shared mechanism: when present, appended as its own
  // paragraph instructing the model to target one specific sub-skill
  // instead of freely decomposing the topic - Step 40 (explicit tutor pick)
  // and Step 41 (return-to-fundamentals routing) both build different text
  // for this same field, never both at once (see the two generation
  // routes).
  subSkillDirective?: string;
  // Phase B Wave 1 (B10 re-practice / B11 smart learning): when present,
  // overrides the free topic decomposition and forces every question onto
  // exactly these specific canonical sub-skill names (from the submission
  // data / mastery map), giving a short focused 5-question set. Mutually
  // exclusive with subSkillDirective - callers must never set both.
  focusSubSkills?: string[];
  // Phase B Wave 4 (B67): optional pinned exam board (AQA/Edexcel/OCR/CIE/
  // SAT/ACT) so generation matches that board's style and difficulty. Only
  // present for England/US students who chose a board - left out entirely
  // otherwise (Ontario has no board, and "no board" is a valid choice).
  examBoard?: string;
  // W5 B76 (flexible task setting): when every student in an assignment must
  // receive a DIFFERENT question set (anti-cheating) rather than one shared
  // deck, this tells the model the variant must not repeat another student's
  // wording, numbers, or diagrams for the same topic. The sampled output is
  // naturally distinct per call; this makes the intent explicit.
  uniqueVariant?: boolean;
}

export function buildUserPrompt(params: WorksheetPromptParams): string {
  const subjectHint = params.subjectHint.length > 0 ? params.subjectHint.join(', ') : 'not specified';
  const questionCount = params.questionCount ?? 10;

  // B10/B11 focused re-practice / smart-learning sets bypass the free topic
  // decomposition entirely and pin every question to the caller-supplied
  // canonical sub-skill names (taken from submission data / the mastery map),
  // keeping sub_skill naming stable for mastery tracking.
  const focusText = params.focusSubSkills?.length
    ? `Question structure:
5 questions, each on ONE of these exact sub-skills only (a short focused
set, not a full topic decomposition):
- ${params.focusSubSkills.join('\n- ')}
Write every question on one of the exact sub-skill names listed above and set
that question's sub_skill to that exact name - do not rename them and do not
decompose into any sub-skill not listed. Together cover all of the listed
sub-skills.`
    : undefined;

  const questionStructure = params.cramStyle
    ? `Question structure:
${questionCount} mixed core questions, a high-intensity exam-week set (no
warm-up, no challenge - every question at level or above), timed like a real
exam. Draw the board from the exact sub-skills below:
- ${params.focusSubSkills?.join('\n- ') ?? 'the student\'s weakest sub-skills'}
Set each question's sub_skill to exactly one of the listed names - never
rename them and never decompose into a sub-skill not listed. Mix the listed
sub-skills across the questions rather than grouping them.`
    : params.focusSubSkills?.length
      ? focusText ?? ''
      : params.dailyStyle
        ? `${questionCount} core questions, all at level - a focused daily practice set targeting the described weakness (no warm-up, no challenge questions).`
        : questionCount === 5
          ? `Question structure:
5 core questions, all targeting the same single sub-skill - a short,
focused daily practice set, not a full topic decomposition.`
          : `Question structure:
2 warm-up (slightly below level - builds confidence)
6 core (at level - targets the described weakness directly)
2 challenge (above level - clearly labelled, students expect it to be harder)`;

  const subSkillDirectiveText = params.subSkillDirective ? `\n${params.subSkillDirective}` : '';

  const uniqueVariantText = params.uniqueVariant
    ? `\nUnique variant: generate a DIFFERENT question set from any other produced for this same topic - every student in this assignment must receive distinct questions, so change wording, numbers, and diagram parameters rather than repeating familiar examples.`
    : '';

  // B67: only emit the exam-board line when a board was actually picked -
  // Ontario has no board and "no board" is a valid England/US choice, so an
  // absent value is left out entirely rather than prompting across an empty
  // string. The model's own board-style guidance lives in systemPrompt.ts.
  const examBoardLine = params.examBoard ? `Exam board: ${params.examBoard}\n` : '';

  return `Student name: ${params.studentName}
Country: ${params.country}
Curriculum level: ${params.curriculumLevel}
Year or grade: ${params.yearLevel}
${examBoardLine}Subject hint: ${subjectHint}
Recent session notes: ${params.sessionNotes}
Topic to practice: ${params.topicPrompt}
${questionStructure}
Include coloured diagrams wherever they help understanding.
In alignment_note write one sentence confirming suitability, naming the exam
board where relevant (England only - Ontario and US do not have exam boards
in this sense).${subSkillDirectiveText}${uniqueVariantText}
Return only the JSON object.`;
}
