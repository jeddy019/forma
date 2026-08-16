import {
  escapeHtml,
  formatDate,
  FONT_LINKS,
  MATHJAX_SCRIPTS,
  buildFooterTemplate,
  type WorksheetHeaderData,
} from './worksheet-template';

export type MarkSchemeHeaderData = Omit<WorksheetHeaderData, 'digitalCode'>;

export interface MarkSchemeQuestionPart {
  part_label: string | null;
  marks: number;
  answer: string;
  M1: string;
  A1: string;
  common_error: string;
  allow: string;
}

export interface MarkSchemeQuestion {
  id: string;
  type: 'warm-up' | 'core' | 'challenge';
  parts: MarkSchemeQuestionPart[];
}

export interface MarkSchemeTemplateData {
  header: MarkSchemeHeaderData;
  questions: MarkSchemeQuestion[];
}

export interface MarkSchemePdfInput {
  html: string;
  footerTemplate: string;
}

// ---------------------------------------------------------------------------
// Section dividers - same rule as worksheet-template.ts's sectionDividerLabel
// (Warm-up appears once before the first warm-up question, Challenge once
// before the first challenge question, core questions get none), duplicated
// here rather than imported because the two documents' Question types no
// longer share a compatible `parts` shape (mark scheme parts have no
// diagram_spec/working_lines). This logic is intentionally small.
// ---------------------------------------------------------------------------

function sectionDividerLabel(
  question: MarkSchemeQuestion,
  index: number,
  questions: MarkSchemeQuestion[]
): 'Warm-up' | 'Challenge' | null {
  const prevType = index > 0 ? questions[index - 1].type : null;
  if (question.type === 'warm-up' && prevType === null) return 'Warm-up';
  if (question.type === 'challenge' && prevType !== 'challenge') return 'Challenge';
  return null;
}

// ---------------------------------------------------------------------------
// Question / part rendering
// ---------------------------------------------------------------------------

function renderPart(part: MarkSchemeQuestionPart, indented: boolean): string {
  // The heading row (label + this part's own mark allocation) only earns
  // its place on multi-part questions - on a single-part question the
  // question header already shows the mark total, so repeating it here
  // with no (a)/(b) label to justify a second line is pure duplication.
  const heading = indented
    ? `<div class="ms-part-heading">
    <span class="part-label">(${escapeHtml(part.part_label ?? '')})</span>
    <span class="ms-part-marks">[${part.marks} ${part.marks === 1 ? 'mark' : 'marks'}]</span>
  </div>`
    : '';
  return `<div class="${indented ? 'ms-part indented' : 'ms-part'}">
  ${heading}
  <div class="ms-answer-box">
    <div class="ms-line"><span class="ms-line-label">M1:</span> ${escapeHtml(part.M1)}</div>
    <div class="ms-line"><span class="ms-line-label">A1:</span> ${escapeHtml(part.A1)}</div>
    <div class="ms-line ms-answer"><span class="ms-line-label">Answer:</span> ${escapeHtml(part.answer)}</div>
    <div class="ms-line"><span class="ms-line-label">Allow:</span> ${escapeHtml(part.allow)}</div>
    <div class="ms-line"><span class="ms-line-label">Common error:</span> ${escapeHtml(part.common_error)}</div>
  </div>
</div>`;
}

function renderQuestion(question: MarkSchemeQuestion, index: number, questions: MarkSchemeQuestion[]): string {
  const divider = sectionDividerLabel(question, index, questions);
  const dividerHtml = divider
    ? `<div class="section-divider ${divider === 'Warm-up' ? 'warm-up' : 'challenge'}">${divider}</div>`
    : '';

  const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
  const isMultiPart = question.parts.length > 1;
  const partsHtml = question.parts.map((part) => renderPart(part, isMultiPart)).join('');

  return `${dividerHtml}<div class="question-block">
  <div class="question-header">
    <span class="q-number">Q${index + 1}</span>
    <span class="q-marks">[${totalMarks} ${totalMarks === 1 ? 'mark' : 'marks'}]</span>
  </div>
  ${partsHtml}
</div>`;
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

// Header block (row 1-4) is visually identical to worksheet-template.ts's,
// with "Mark Scheme" appended after the student name per the MARK SCHEME PDF
// spec, and no QR/digital_code (worksheet-only). Kept as its own copy rather
// than a shared function - the "Mark Scheme" suffix and dropped QR make the
// two header markups different enough that extracting a shared function
// would need its own set of options flags for what is, in practice, two
// short and stable blocks of markup.
const PAGE_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #F7F4EF; color: #1A1A18; font-family: 'Inter', sans-serif; font-weight: 400; }
.header-row-1 { display: flex; align-items: baseline; justify-content: space-between; }
.student-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #1A1A18; }
.student-name .ms-suffix { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 500; color: #5C5849; }
.wordmark { font-family: 'Playfair Display', serif; font-size: 13px; color: #1A3D2E; }
.header-rule { border: none; border-top: 2px solid #1A3D2E; margin: 8px 0 10px; }
.badges { display: flex; gap: 8px; margin-bottom: 8px; }
.badge { display: inline-block; background: #E8F2ED; color: #1A3D2E; font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 500; letter-spacing: 0.06em; border-radius: 20px; padding: 3px 10px; }
.alignment-note { font-family: 'Inter', sans-serif; font-size: 10px; font-style: italic; color: #9A9080; margin-bottom: 4px; }
.topic-date { font-family: 'Inter', sans-serif; font-size: 11px; color: #9A9080; margin-bottom: 20px; }
.section-divider { font-family: 'Inter', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; margin: 16px 0 8px; page-break-after: avoid; }
.section-divider.warm-up { color: #C8A84B; }
.section-divider.challenge { color: #1A3D2E; }
.question-block { page-break-inside: avoid; margin-bottom: 20px; }
.question-header { display: flex; justify-content: space-between; align-items: baseline; }
.q-number { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: #1A3D2E; }
.q-marks { font-family: 'Inter', sans-serif; font-size: 10px; color: #9A9080; }
.ms-part { margin-top: 10px; }
.ms-part.indented { padding-left: 16px; }
.ms-part-heading { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-family: 'Inter', sans-serif; font-size: 13px; color: #1A1A18; }
.part-label { font-weight: 600; }
.ms-part-marks { font-family: 'Inter', sans-serif; font-size: 10px; color: #9A9080; white-space: nowrap; }
.ms-answer-box { background: #E8F2ED; border-radius: 10px; padding: 10px 14px; margin-top: 4px; }
.ms-line { font-family: 'Inter', sans-serif; font-size: 12px; color: #1A1A18; line-height: 1.6; }
.ms-line + .ms-line { margin-top: 2px; }
.ms-line-label { font-weight: 600; color: #1A3D2E; margin-right: 4px; }
.ms-answer { font-weight: 500; }
`;

export function renderMarkSchemeHtml(data: MarkSchemeTemplateData): MarkSchemePdfInput {
  const { header, questions } = data;

  const alignmentNoteText =
    header.alignmentNote ??
    `Questions are appropriate for ${header.curriculumLevelForFallback} ${header.subject}.`;

  const questionsHtml = questions.map((question, index) => renderQuestion(question, index, questions)).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
${FONT_LINKS}
${MATHJAX_SCRIPTS}
<style>${PAGE_STYLES}</style>
</head>
<body>
  <div class="header-row-1">
    <span class="student-name">${escapeHtml(header.studentName)} <span class="ms-suffix">Mark Scheme</span></span>
    <span class="wordmark">Forma</span>
  </div>
  <hr class="header-rule">
  <div class="badges">
    <span class="badge">${escapeHtml(header.curriculumBadge)}</span>
    <span class="badge">${escapeHtml(header.yearOrGradeBadge)}</span>
    <span class="badge">${escapeHtml(header.subject)}</span>
  </div>
  <div class="alignment-note">${escapeHtml(alignmentNoteText)}</div>
  <div class="topic-date">${escapeHtml(header.topic)} - ${formatDate(header.createdAt)}</div>
  ${questionsHtml}
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate() };
}
