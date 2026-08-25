import type { DiagramSpec } from '../ai/schema';

// Shared HTML/type primitives, not a worksheet renderer any more. PDF
// rendering moved to src/lib/render/worksheetHtml.ts (HTML -> Chromium
// print, fonts embedded via src/lib/render/printStyles.ts). What's left
// here is still load-bearing for two other surfaces:
//   - invoice-template.ts (invoices stay on Puppeteer/HTML - no maths, no
//     diagrams, nothing to gain from moving) imports escapeHtml,
//     formatDate, and buildFooterTemplate from here.
//   - the live /s/[code] student page builds its student-safe question
//     shape from the WorksheetQuestion types here, since that page renders
//     the same questions_json structure in the browser, independently of
//     how the PDF gets built.

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

// ---------------------------------------------------------------------------
// Helpers - still used by invoice-template.ts (Puppeteer/HTML path).
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

// The footer is the one piece of the layout that genuinely repeats on every
// printed page, so it goes through Puppeteer's footerTemplate mechanism
// rather than being part of the HTML flow. Puppeteer renders header/footer
// templates in an isolated context that doesn't see the main document's
// <link> stylesheets, so this falls back to a system sans-serif instead of
// Inter. Still used by invoice-template.ts.
export function buildFooterTemplate(): string {
  return `<div style="width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #9A9080; padding: 0 22mm; box-sizing: border-box;">
  <div style="border-top: 0.5px solid #E0D9D0; padding-top: 4px; display: flex; justify-content: space-between;">
    <span>Forma</span>
    <span><span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
</div>`;
}
