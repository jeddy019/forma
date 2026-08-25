import qrcode from 'qrcode-generator';
import { renderRichText } from './richText';
import { printDocumentHead } from './printStyles';
import {
  escapeHtml,
  formatDate,
  type WorksheetHeaderData,
  type WorksheetQuestion,
  type WorksheetQuestionPart,
  type WorksheetTemplateData,
} from '../pdf/worksheet-template';
import type {
  MarkSchemeQuestion,
  MarkSchemeTemplateData,
} from '../pdf/mark-scheme-template';
import { renderDiagramSvg } from '../diagrams/renderDiagramSpec';
import { sectionDividerLabel } from '../worksheet/sectionDividerLabel';
import { CODING_SUBJECTS } from '../constants';

// ---------------------------------------------------------------------------
// One renderer, two skins. This file is the SINGLE source that turns
// questions_json into a printable document (HTML -> Chromium print, replacing
// the LuaLaTeX microservice entirely). The rich-text core it consumes lives
// in richText.ts - split out so the /s/[code] digital page can run the same
// pipeline from a Server Component without dragging this file's Node-only
// dependencies (fs/createRequire/qrcode) into an RSC graph. Print and
// digital can never diverge on how AI output is interpreted: same function.
//
// Document-level subject handling lives here: Fira Code as whole-document
// body font for the four CS subjects, print-safe palette below.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Print-safe palette (mirrors the LaTeX template's COLOUR FLOOR exactly -
// nothing lighter than #5C5849 on paper).
// ---------------------------------------------------------------------------
const C = {
  primary: '#1A3D2E',
  accent: '#C8A84B',
  textPrimary: '#1A1A18',
  textSecondaryPrint: '#2E2A24',
  textMutedPrint: '#5C5849',
  workingLine: '#7A7068',
  borderDefault: '#E0D9D0',
  badgeBg: '#E8F2ED',
};

// Lazy on purpose: printStyles touches the real filesystem, which must never
// happen during Turbopack's module-evaluation phase - only at request time.
let bakedPrintHeadCache: string | null = null;
function bakedPrintHead(): string {
  if (bakedPrintHeadCache === null) {
    bakedPrintHeadCache = printDocumentHead();
  }
  return bakedPrintHeadCache;
}

function isCodingSubject(subject: string): boolean {
  return (CODING_SUBJECTS as readonly string[]).includes(subject);
}

function documentCss(subject: string): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${isCodingSubject(subject) ? "'Fira Code', monospace" : "'Inter', sans-serif"};
      color: ${C.textPrimary};
      font-size: 11pt;
      line-height: 1.45;
    }
    .cover { height: 100vh; page-break-after: always; position: relative; text-align: center; }
    .cover-inner { padding-top: 55mm; }
    .wordmark { font-family: 'Playfair Display', serif; font-weight: 600; color: ${C.primary}; }
    .cover .wordmark.small { font-size: 13pt; margin-bottom: 16mm; }
    .cover h1 { font-family: 'Playfair Display', serif; font-weight: 600; font-size: 30pt; color: ${C.textPrimary}; margin-bottom: 3mm; }
    .cover h2 { font-family: 'Playfair Display', serif; font-weight: 500; font-size: 20pt; color: ${C.textSecondaryPrint}; }
    .info-box { border: 0.5px solid ${C.borderDefault}; background: ${C.badgeBg}; border-radius: 2mm; padding: 5mm 6mm; margin: 14mm auto 6mm; width: 80%; display: flex; justify-content: space-between; text-align: left; }
    .info-box .cell { flex: 1; }
    .info-box .label { font-size: 9pt; color: ${C.textMutedPrint}; display: block; margin-bottom: 1mm; }
    .info-box .value { font-size: 11pt; color: ${C.textPrimary}; }
    .pace-line { font-size: 10pt; color: ${C.textMutedPrint}; }
    .instructions { text-align: left; width: 80%; margin: 10mm auto 0; }
    .instructions h3 { font-size: 10pt; color: ${C.textSecondaryPrint}; margin-bottom: 2mm; }
    .instructions li { list-style: none; font-size: 10pt; color: ${C.textSecondaryPrint}; padding-left: 5mm; position: relative; margin-bottom: 1mm; }
    .instructions li::before { content: '\\2022'; color: ${C.accent}; position: absolute; left: 0; }
    .marketing { position: absolute; bottom: 15mm; left: 0; right: 0; font-size: 10pt; color: ${C.textMutedPrint}; }
    .header-row1 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2mm; }
    .header-row1 .student { font-family: 'Playfair Display', serif; font-weight: 600; font-size: 18pt; color: ${C.textPrimary}; }
    .header-row1 .mark { font-family: 'Playfair Display', serif; font-size: 11pt; color: ${C.primary}; }
    .header-rule { border: none; border-top: 1.4pt solid ${C.primary}; margin-bottom: 2.5mm; }
    .badges { margin-bottom: 2mm; }
    .badge { display: inline-block; background: ${C.badgeBg}; color: ${C.primary}; font-size: 9pt; letter-spacing: 0.03em; padding: 0.8mm 2.4mm; border-radius: 1.2mm; margin-right: 2.5mm; }
    .alignment-note { font-size: 9pt; font-style: italic; color: ${C.textMutedPrint}; margin-bottom: 1mm; }
    .topic-date { font-size: 10pt; color: ${C.textMutedPrint}; margin-bottom: 5mm; }
    .divider { page-break-inside: avoid; margin-top: 4mm; margin-bottom: 3mm; }
    .divider .label { font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; display: block; margin-bottom: 1mm; }
    .divider .rule { border: none; border-top: 0.5pt solid ${C.borderDefault}; }
    .question { page-break-inside: avoid; margin-bottom: 3mm; }
    .q-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1.5mm; }
    .q-head .qnum { font-weight: 600; color: ${C.primary}; }
    .q-head .marks { font-size: 9pt; color: ${C.textMutedPrint}; }
    .part { margin-left: 4mm; margin-bottom: 2.5mm; }
    .part-text-line { display: flex; justify-content: space-between; gap: 4mm; margin-bottom: 2.5mm; }
    .part-text { flex: 1; }
    .part-marks { font-size: 9pt; color: ${C.textMutedPrint}; white-space: nowrap; }
    .part-label { font-weight: 600; }
    .diagram { text-align: center; margin: 2mm 0 3mm; page-break-inside: avoid; }
    .diagram svg { max-width: 70%; height: auto; max-height: 90mm; }
    .answer-space { border-top: 0.5pt solid ${C.borderDefault}; padding-top: 2.5mm; }
    .working-lines div { border-bottom: 0.4pt solid ${C.workingLine}; height: 3.8mm; }
    .code-block { font-family: 'Fira Code', monospace; font-size: 9.5pt; background: #F7F4EF; border: 0.5px solid ${C.borderDefault}; border-radius: 1.5mm; padding: 3mm 4mm; margin: 2mm 0; white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
    .katex { font-size: 1.06em; }
    .qr-block { page-break-inside: avoid; margin-top: 6mm; text-align: right; }
    .qr-block svg { width: 40mm; height: 40mm; }
    .qr-block .label { font-size: 9pt; color: ${C.textMutedPrint}; display: block; margin-top: 1mm; }
    /* Mark scheme */
    .ms-part { page-break-inside: avoid; margin-bottom: 4mm; }
    .ms-answer { background: ${C.badgeBg}; border-radius: 1.5mm; padding: 3mm 4mm; margin-top: 2mm; font-size: 10pt; color: ${C.textSecondaryPrint}; }
    .ms-answer p { margin-bottom: 1.5mm; }
    .ms-answer .tag { font-weight: 600; color: ${C.primary}; }
  `;
}

function badgesRow(curriculum: string, yearOrGrade: string, subject: string): string {
  const badge = (text: string) => (text ? `<span class="badge">${escapeHtml(text)}</span>` : '');
  return `<div class="badges">${badge(curriculum)}${badge(yearOrGrade)}${badge(subject)}</div>`;
}

function renderCoverPage(header: WorksheetHeaderData): string {
  return `
  <section class="cover">
    <div class="cover-inner">
      <div class="wordmark small">Forma</div>
      <h1>${escapeHtml(header.subject)}</h1>
      <h2>${escapeHtml(header.topic)}</h2>
    </div>
    <div class="info-box">
      <div class="cell"><span class="label">Name</span><span class="value">${escapeHtml(header.studentName)}</span></div>
      <div class="cell"><span class="label">Year group</span><span class="value">${escapeHtml(header.yearOrGradeBadge)}</span></div>
      <div class="cell"><span class="label">Date</span><span class="value">${formatDate(header.createdAt)}</span></div>
    </div>
    <p class="pace-line">${escapeHtml(header.curriculumBadge)} &bull; Suggested pace: work through steadily, there is no fixed time limit.</p>
    <div class="instructions">
      <h3><strong>Before you start</strong></h3>
      <ul>
        <li>Answer all questions.</li>
        <li>Show your working in the space provided.</li>
        <li>Write clearly in black or blue ink.</li>
        <li>Diagrams are not drawn to scale unless stated.</li>
        <li>Check your answers before finishing.</li>
      </ul>
    </div>
    <div class="marketing">This assignment was built by Forma, a personalised practice platform.<br>forma.app</div>
  </section>`;
}

function renderHeaderBlock(header: Omit<WorksheetHeaderData, 'digitalCode'>, titleSuffix: string): string {
  const alignmentNote =
    header.alignmentNote ?? `Questions are appropriate for ${header.curriculumLevelForFallback} ${header.subject}.`;
  return `
  <div class="header-row1">
    <span class="student">${escapeHtml(header.studentName)}${titleSuffix}</span>
    <span class="mark">Forma</span>
  </div>
  <hr class="header-rule">
  ${badgesRow(header.curriculumBadge, header.yearOrGradeBadge, header.subject)}
  <p class="alignment-note">${escapeHtml(alignmentNote)}</p>
  <p class="topic-date">${escapeHtml(header.topic)} - ${formatDate(header.createdAt)}</p>`;
}

function diagramBlock(part: WorksheetQuestionPart): string {
  if (!part.diagram_spec) return '';
  const svg = renderDiagramSvg(part.diagram_spec);
  return svg ? `<div class="diagram">${svg}</div>` : '';
}

function renderWorksheetQuestion(question: WorksheetQuestion, index: number, questions: WorksheetQuestion[]): string {
  const divider = sectionDividerLabel(question, index, questions);
  const dividerBlock = divider
    ? `<div class="divider"><span class="label" style="color: ${divider === 'Warm-up' ? C.accent : C.primary}">${escapeHtml(divider)}</span><hr class="rule"></div>`
    : '';

  const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
  const isMultiPart = question.parts.length > 1;

  const partsHtml = question.parts
    .map((part) => {
      const label = part.part_label ? `<span class="part-label">(${escapeHtml(part.part_label)})</span> ` : '';
      return `
      <div class="${isMultiPart ? 'part' : ''}">
        <div class="part-text-line">
          <div class="part-text">${label}${renderRichText(part.text)}</div>
          <div class="part-marks">[${part.marks}]</div>
        </div>
        ${diagramBlock(part)}
        <div class="answer-space"><div class="working-lines">${'<div></div>'.repeat(Math.max(1, part.working_lines))}</div></div>
      </div>`;
    })
    .join('');

  return `${dividerBlock}
  <div class="question">
    <div class="q-head"><span class="qnum">Q${index + 1}</span><span class="marks">[${totalMarks}]</span></div>
    ${partsHtml}
  </div>`;
}

function qrBlock(digitalCode: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(`https://forma.app/s/${digitalCode}`);
  qr.make();
  const svg = qr.createSvgTag({ scalable: true, margin: 0 });
  return `
  <div class="qr-block">
    ${svg}
    <span class="label">Complete this digitally at forma.app/s/${escapeHtml(digitalCode)}</span>
  </div>`;
}

export function renderWorksheetHtml(data: WorksheetTemplateData): string {
  const { header, questions } = data;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${bakedPrintHead()}
<style>${documentCss(header.subject)}</style>
</head>
<body>
${renderCoverPage(header)}
<section>
${renderHeaderBlock(header, '')}
${questions.map((question, index) => renderWorksheetQuestion(question, index, questions)).join('\n')}
${qrBlock(header.digitalCode)}
</section>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Mark scheme - same header with "Mark Scheme" appended, green answer boxes,
// no cover page and no QR (tutor-only document).
// ---------------------------------------------------------------------------

function renderMarkSchemeQuestion(question: MarkSchemeQuestion, index: number): string {
  const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
  const isMultiPart = question.parts.length > 1;
  const partsHtml = question.parts
    .map((part) => {
      const label = isMultiPart && part.part_label ? `<span style="color: ${C.primary}">(${escapeHtml(part.part_label)})</span> ` : '';
      const partMarks = isMultiPart ? ` <span style="font-size: 9pt; color: ${C.textMutedPrint}">[${part.marks}]</span>` : '';
      const line = (tag: string, key: 'answer' | 'M1' | 'A1' | 'allow' | 'common_error') =>
        part[key] ? `<p><span class="tag">${tag}:</span> ${renderRichText(String(part[key]))}</p>` : '';
      return `
      <div class="ms-part">
        ${label}${partMarks}
        <div class="ms-answer">
          ${line('Answer', 'answer')}
          ${line('M1', 'M1')}
          ${line('A1', 'A1')}
          ${line('Allow', 'allow')}
          ${line('Common error', 'common_error')}
        </div>
      </div>`;
    })
    .join('');
  return `
  <div class="question">
    <div class="q-head"><span class="qnum">Q${index + 1}</span><span class="marks">[${totalMarks} marks]</span></div>
    ${partsHtml}
  </div>`;
}

export function renderMarkSchemeHtml(data: MarkSchemeTemplateData): string {
  const { header, questions } = data;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${bakedPrintHead()}
<style>${documentCss(header.subject)}</style>
</head>
<body>
<section>
${renderHeaderBlock(header, ' <span style="font-size: 12pt; color: ' + C.textMutedPrint + '">Mark Scheme</span>')}
${questions.map((question, index) => renderMarkSchemeQuestion(question, index)).join('\n')}
</section>
</body>
</html>`;
}
