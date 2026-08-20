import qrcode from 'qrcode-generator';
import type { DiagramSpec } from '../ai/schema';
import { renderDiagramSvg } from '../diagrams/renderDiagramSpec';
import { sectionDividerLabel } from '../worksheet/sectionDividerLabel';

export interface WorksheetHeaderData {
  studentName: string;
  subject: string;
  topic: string;
  /** Badge 1, e.g. "GCSE", "KS3", "Ontario Grade 10" */
  curriculumBadge: string;
  /** Badge 2, e.g. "Year 10", "Grade 10" */
  yearOrGradeBadge: string;
  alignmentNote: string | null;
  /** Used only to build the fallback sentence when alignmentNote is null. */
  curriculumLevelForFallback: string;
  digitalCode: string;
  createdAt: Date;
}

export interface WorksheetQuestionPart {
  part_label: string | null;
  text: string;
  marks: number;
  diagram_spec: DiagramSpec | null;
  working_lines: number;
}

export interface WorksheetQuestion {
  id: string;
  type: 'warm-up' | 'core' | 'challenge';
  parts: WorksheetQuestionPart[];
}

export interface WorksheetTemplateData {
  header: WorksheetHeaderData;
  questions: WorksheetQuestion[];
}

export interface WorksheetPdfInput {
  html: string;
  footerTemplate: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// All AI-generated free text (question text, alignment notes, badges,
// student names) flows straight into page.setContent() as real HTML, so it
// must be escaped - an unescaped '<' from the model's output would otherwise
// be parsed as a tag rather than displayed as text.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

// ---------------------------------------------------------------------------
// Section dividers - "Warm-up" appears once, immediately before Q1;
// "Challenge" appears once, immediately before the first challenge question.
// Core questions get no divider. Driven by type transitions rather than a
// hardcoded index so it isn't brittle to the exact 2/6/2 split.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Question / part rendering
// ---------------------------------------------------------------------------

function renderWorkingLines(count: number): string {
  const lines = Math.max(1, count);
  return Array.from({ length: lines }, () => '<div class="working-line"></div>').join('');
}

function renderPart(part: WorksheetQuestionPart, indented: boolean): string {
  const diagram = part.diagram_spec ? `<div class="diagram">${renderDiagramSvg(part.diagram_spec)}</div>` : '';
  const label = part.part_label ? `<span class="part-label">(${escapeHtml(part.part_label)})</span> ` : '';
  return `<div class="${indented ? 'part indented' : 'part'}">
  <div class="part-text-row">
    <span class="part-text">${label}${escapeHtml(part.text)}</span>
    <span class="part-marks">[${part.marks}]</span>
  </div>
  ${diagram}
  <div class="working-lines">${renderWorkingLines(part.working_lines)}</div>
</div>`;
}

function renderQuestion(question: WorksheetQuestion, index: number, questions: WorksheetQuestion[]): string {
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
    <span class="q-marks">[${totalMarks}]</span>
  </div>
  ${partsHtml}
</div>`;
}

// ---------------------------------------------------------------------------
// QR code - qrcode-generator's `scalable: true` output has no fixed
// width/height attributes, so the surrounding 40mm x 40mm box controls the
// physical size via CSS instead of a cellSize pixel count.
// ---------------------------------------------------------------------------

function renderQrBlock(digitalCode: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(`https://forma.app/s/${digitalCode}`);
  qr.make();
  const svg = qr.createSvgTag({ scalable: true });
  return `<div class="qr-block">
  <div class="qr-code">${svg}</div>
  <div class="qr-label">Complete this digitally at forma.app/s/${escapeHtml(digitalCode)}</div>
</div>`;
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------

// Shared with mark-scheme-template.ts - identical HTML head requirements
// (same fonts, same MathJax setup) for both PDF documents.
export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">`;

export const MATHJAX_SCRIPTS = `<script>
  window.MathJax = {
    tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
    svg: { fontCache: 'global' }
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>`;

// Sizes and colours below are copied verbatim from the "The PDF" section of
// CLAUDE.md, which defines its own print-specific type scale distinct from
// the in-app Design System sizes list (11/13/15/17/20/24/30/38/48).
const PAGE_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #F7F4EF; color: #1A1A18; font-family: 'Inter', sans-serif; font-weight: 400; }
.header-row-1 { display: flex; align-items: baseline; justify-content: space-between; }
.student-name { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; color: #1A1A18; }
.wordmark { font-family: 'Playfair Display', serif; font-size: 13px; color: #1A3D2E; }
.header-rule { border: none; border-top: 2px solid #1A3D2E; margin: 8px 0 10px; }
.badges { display: flex; gap: 8px; margin-bottom: 8px; }
.badge { display: inline-block; background: #E8F2ED; color: #1A3D2E; font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 500; letter-spacing: 0.06em; border-radius: 20px; padding: 3px 10px; }
.alignment-note { font-family: 'Inter', sans-serif; font-size: 10px; font-style: italic; color: #9A9080; margin-bottom: 4px; }
.topic-date { font-family: 'Inter', sans-serif; font-size: 11px; color: #9A9080; margin-bottom: 20px; }
.section-divider { font-family: 'Inter', sans-serif; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; margin: 22px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #E0D9D0; page-break-after: avoid; }
.section-divider.warm-up { color: #C8A84B; }
.section-divider.challenge { color: #1A3D2E; }
.question-block { page-break-inside: avoid; margin-bottom: 26px; }
.question-header { display: flex; justify-content: space-between; align-items: baseline; }
.q-number { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; color: #1A3D2E; }
.q-marks { font-family: 'Inter', sans-serif; font-size: 10px; color: #9A9080; }
.part { margin-top: 8px; }
.part.indented { padding-left: 16px; }
.part-text-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.part-text { font-family: 'Inter', sans-serif; font-size: 13px; color: #1A1A18; line-height: 1.6; }
.part-label { font-weight: 600; }
.part-marks { font-family: 'Inter', sans-serif; font-size: 10px; color: #9A9080; white-space: nowrap; }
.diagram { text-align: center; margin: 12px 0; }
.diagram svg { max-width: 100%; height: auto; }
.working-lines { margin-top: 10px; padding-top: 8px; border-top: 0.5px solid #E0D9D0; }
.working-line { border-bottom: 0.5px solid #D0C8BC; height: 24px; }
.qr-block { page-break-inside: avoid; margin-top: 24px; text-align: right; }
.qr-code { display: inline-block; width: 40mm; height: 40mm; }
.qr-code svg { width: 100%; height: 100%; }
.qr-label { font-family: 'Inter', sans-serif; font-size: 9px; color: #9A9080; margin-top: 4px; }
`;

// The footer is the one piece of the layout that genuinely repeats on every
// printed page, so it goes through Puppeteer's footerTemplate mechanism
// (see the generatePdf() call site) rather than being part of the HTML flow.
// Puppeteer renders header/footer templates in an isolated context that
// doesn't see the main document's <link> stylesheets, so this falls back to
// a system sans-serif instead of Inter.
// Shared with mark-scheme-template.ts - same footer on both documents.
export function buildFooterTemplate(): string {
  return `<div style="width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #9A9080; padding: 0 22mm; box-sizing: border-box;">
  <div style="border-top: 0.5px solid #E0D9D0; padding-top: 4px; display: flex; justify-content: space-between;">
    <span>Forma</span>
    <span><span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
</div>`;
}

export function renderWorksheetHtml(data: WorksheetTemplateData): WorksheetPdfInput {
  const { header, questions } = data;

  const alignmentNoteText =
    header.alignmentNote ??
    `Questions are appropriate for ${header.curriculumLevelForFallback} ${header.subject}.`;

  // QR block placed after the last question rather than pinned to a fixed
  // page position: Puppeteer's per-page header/footer templates can't be
  // made conditional on "last page only", and this content's total page
  // count isn't known until Chrome paginates it. Ending the flow here means
  // it lands, right-aligned, wherever the last page's remaining space is -
  // functionally "last page" for every worksheet length this product
  // generates, though not a pixel-anchored corner.
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
    <span class="student-name">${escapeHtml(header.studentName)}</span>
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
  ${renderQrBlock(header.digitalCode)}
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate() };
}
