import { buildFooterTemplate, escapeHtml, formatDate } from './worksheet-template';
import { printFontFaces } from '@/lib/render/printStyles';
import { BRANDING_DEFAULTS, type Branding } from '../branding';
import type { WeeklyReportData } from '@/lib/report/buildWeeklyReport';
import type { SessionBriefNote } from '@/lib/brief/buildSessionBrief';

// Phase B W3 (session brief): the founder's before-session prep document.
// Same premium document language as the weekly report (wordmark, rule,
// Playfair name, data numerals, practice log, gold-edged note block) but
// founder-facing: recent practice data plus the founder's OWN last session
// note, verbatim - the reason the brief is useful at all is continuity, so
// the last note is never rewritten or summarised. Same embedded-fonts /
// zero-runtime-fetch discipline as every other printed document - no maths,
// so no KaTeX.
//
// COLOUR FLOOR (same PDF-only rule as the worksheet templates): nothing
// below #5C5849 for body text, gold #C8A84B kept for the section accent
// marks, and the brand accent (default #1A3D2E) reserved for the wordmark,
// the header rule, and the headline score numeral.

export interface SessionBriefTemplateData {
  studentName: string;
  /** Optional curriculum context line under the name, e.g. "GCSE - Year 10". */
  contextLine: string | null;
  windowLabel: string;
  brief: WeeklyReportData;
  lastNote: SessionBriefNote | null;
  brand?: Branding;
}

const BRIEF_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #F7F4EF; color: #1A1A18; font-family: 'Inter', sans-serif; font-weight: 400; padding: 40px; }
.wordmark { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; }
.doc-label { font-family: 'Inter', sans-serif; font-size: 13px; color: #5C5849; }
.header-rule { border: none; border-top: 2.5px solid; margin: 10px 0 30px; }
.student-name { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 600; color: #1A1A18; }
.context-line { font-size: 13px; color: #5C5849; margin-top: 4px; }
.period-line { font-size: 13px; color: #5C5849; margin-top: 4px; }
.section-mark { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #C8A84B; font-weight: 600; margin: 32px 0 12px; }
.data-grid { display: flex; gap: 24px; }
.data-stat { flex: 1; border: 1px solid #E0D9D0; border-radius: 8px; padding: 20px; background: #F0EBE3; }
.data-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #5C5849; font-weight: 600; }
.data-num { font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 600; margin-top: 6px; }
.data-note { font-size: 13px; color: #5C5849; margin-top: 4px; }
.score-num { font-size: 30px; }
.log-table { width: 100%; border-collapse: collapse; }
.log-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #5C5849; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #E0D9D0; }
.log-table td { font-size: 13px; color: #1A1A18; padding: 10px 0; border-bottom: 0.5px solid #E0D9D0; }
.log-table td.score { font-weight: 500; color: #2E2A24; }
.note-block { border-left: 3px solid #C8A84B; background: #FEF9EC; padding: 16px 20px; border-radius: 0 8px 8px 0; }
.note-date { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #5C5849; font-weight: 600; margin-bottom: 8px; }
.note-block p.note-content { font-size: 15px; line-height: 1.6; color: #1A1A18; white-space: pre-wrap; }
.empty-note { font-size: 13px; color: #7A7068; font-style: italic; }
`;

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date);
}

function lastNoteBlock(lastNote: SessionBriefNote | null): string {
  if (!lastNote) {
    return `<p class="empty-note">No session note recorded yet. Record one after your next session - the brief reads your practice since then.</p>`;
  }
  return `
  <div class="note-block">
    <p class="note-date">Recorded ${escapeHtml(formatShortDate(new Date(lastNote.createdAt)))}</p>
    <p class="note-content">${escapeHtml(lastNote.content)}</p>
  </div>`;
}

export function renderSessionBriefHtml(data: SessionBriefTemplateData): { html: string; footerTemplate: string } {
  const brand = data.brand ?? BRANDING_DEFAULTS;
  const { brief } = data;
  const avg = brief.averageScorePercentage;

  const activityRows =
    brief.activity.length === 0
      ? `<tr><td colspan="3" style="font-size: 13px; color: #5C5849; padding: 12px 0 4px;">No completed practice in this window.</td></tr>`
      : brief.activity
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.dateLabel)}</td>
          <td>${escapeHtml(row.topic)}</td>
          <td class="score">${row.score}%</td>
        </tr>`
          )
          .join('');

  const contextLine = data.contextLine
    ? `<p class="context-line">${escapeHtml(data.contextLine)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${printFontFaces()}</style>
<style>${BRIEF_STYLES}</style>
</head>
<body>
  <div class="header-row-1" style="display: flex; align-items: baseline; justify-content: space-between;">
    <span class="wordmark" style="color: ${escapeHtml(brand.accent)};">${escapeHtml(brand.name)}</span>
    <span class="doc-label">Session brief</span>
  </div>
  <hr class="header-rule" style="color: ${escapeHtml(brand.accent)}; border-color: ${escapeHtml(brand.accent)};">

  <p class="student-name">${escapeHtml(data.studentName)}</p>
  ${contextLine}
  <p class="period-line">${escapeHtml(data.windowLabel)} &middot; Prepared ${escapeHtml(formatDate(new Date()))}</p>

  <p class="section-mark">Practice overview</p>
  <div class="data-grid">
    <div class="data-stat">
      <p class="data-label">Worksheets completed</p>
      <p class="data-num">${brief.worksheetsCompleted}</p>
    </div>
    <div class="data-stat">
      <p class="data-label">Average score</p>
      <p class="data-num score-num" style="color: ${escapeHtml(brand.accent)};">${avg === null ? '&mdash;' : `${avg}%`}</p>
      <p class="data-note">from ${brief.worksheetsCompleted} worksheet${brief.worksheetsCompleted === 1 ? '' : 's'}</p>
    </div>
  </div>
  <div class="data-grid" style="margin-top: 24px;">
    <div class="data-stat">
      <p class="data-label">Strongest topic</p>
      <p class="data-note" style="font-size: 15px; color: #1A1A18; margin-top: 10px;">${brief.strongestTopic ? escapeHtml(brief.strongestTopic) : '&mdash;'}</p>
    </div>
    <div class="data-stat">
      <p class="data-label">Area to work on</p>
      <p class="data-note" style="font-size: 15px; color: #1A1A18; margin-top: 10px;">${brief.areaToImprove ? escapeHtml(brief.areaToImprove) : '&mdash;'}</p>
    </div>
  </div>

  <p class="section-mark">Practice log</p>
  <table class="log-table">
    <thead>
      <tr>
        <th>Date</th>
        <th>Topic</th>
        <th>Score</th>
      </tr>
    </thead>
    <tbody>${activityRows}</tbody>
  </table>

  <p class="section-mark">From the last session</p>
  ${lastNoteBlock(data.lastNote)}
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate(brand.name) };
}