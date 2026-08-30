import { buildFooterTemplate, escapeHtml, formatDate } from './worksheet-template';
import { printFontFaces } from '@/lib/render/printStyles';
import { BRANDING_DEFAULTS, type Branding } from '../branding';
import type { WeeklyReportData } from '@/lib/report/buildWeeklyReport';

// Phase B W2 (weekly branded proof report): the premium parent-facing
// document of the founder model. Hard data on top (worksheets, scores,
// strongest/weakest area, practice log), the founder's own words at the
// bottom, all under the account's brand wordmark. Same embedded-fonts /
// zero-runtime-fetch discipline as every other printed document - no maths,
// so no KaTeX.
//
// W8 Wave C (report enrichment): the document now proves more than a weekly
// average - a 4-week score trend, the difficulty level practised at, distinct
// days practised, this week's topics, sub-skill strengths/weaknesses from the
// mastery map, and the founder's attentiveness check (omitted entirely when
// never set - never invented).
//
// COLOUR FLOOR (same PDF-only rule as the worksheet templates): nothing
// below #5C5849 for body text, gold #C8A84B kept for the section accent
// marks, and the brand accent (default #1A3D2E) reserved for the wordmark,
// the header rule, and the headline score numeral.

export interface WeeklyReportTemplateData {
  studentName: string;
  /** Founder's personal note from this week. */
  tutorNote: string;
  report: WeeklyReportData;
  brand?: Branding;
}

const REPORT_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #F7F4EF; color: #1A1A18; font-family: 'Inter', sans-serif; font-weight: 400; padding: 40px; }
.wordmark { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 600; }
.doc-label { font-family: 'Inter', sans-serif; font-size: 13px; color: #5C5849; }
.header-rule { border: none; border-top: 2.5px solid; margin: 10px 0 30px; }
.student-name { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 600; color: #1A1A18; }
.period-line { font-size: 13px; color: #5C5849; margin-top: 4px; }
.section-mark { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #C8A84B; font-weight: 600; margin: 32px 0 12px; }
.data-grid { display: flex; gap: 16px; margin-top: 24px; }
.data-stat { flex: 1; border: 1px solid #E0D9D0; border-radius: 8px; padding: 18px; background: #F0EBE3; }
.data-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #5C5849; font-weight: 600; }
.data-num { font-family: 'Playfair Display', serif; font-size: 34px; font-weight: 600; margin-top: 6px; }
.data-value { font-size: 15px; color: #1A1A18; margin-top: 10px; }
.score-num { font-size: 28px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.chip { font-size: 12px; color: #1A3D2E; background: #E8F2ED; border-radius: 20px; padding: 5px 12px; }
.chip.muted { color: #7A7068; background: #E5DFD3; }
.subskill-list { font-size: 15px; color: #1A1A18; margin-top: 10px; line-height: 1.6; }
.trend-wrap { border: 1px solid #E0D9D0; border-radius: 8px; background: #F0EBE3; padding: 14px 18px 8px; }
.log-table { width: 100%; border-collapse: collapse; }
.log-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: #5C5849; font-weight: 600; padding: 8px 0; border-bottom: 1px solid #E0D9D0; }
.log-table td { font-size: 13px; color: #1A1A18; padding: 10px 0; border-bottom: 0.5px solid #E0D9D0; }
.log-table td.score { font-weight: 500; color: #2E2A24; }
.attentive-line { font-size: 13px; color: #1A3D2E; margin-bottom: 10px; }
.note-block { border-left: 3px solid #C8A84B; background: #FEF9EC; padding: 16px 20px; border-radius: 0 8px 8px 0; }
.note-block p { font-size: 15px; line-height: 1.6; color: #1A1A18; white-space: pre-wrap; }
.signoff { margin-top: 16px; font-size: 13px; color: #5C5849; }
.empty-note { font-size: 13px; color: #7A7068; font-style: italic; }
`;

// Default framing when the founder has set no standing note and typed
// nothing at send time - a graceful non-claiming baseline, never a
// fabricated personal message.
function defaultNote(studentName: string): string {
  return `This report covers ${studentName}'s practice for the week. If you would like to discuss anything in it, just get in touch.`;
}

function capitalizeDifficulty(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// A fixed 4-bar mini chart - the report's "Score trend". Bars are sized off
// the percentage; a week with no data renders as a muted stub rather than a
// tall empty column, so the presence of history (or its absence) is honest.
function trendSvg(trend: WeeklyReportData['trend'], accent: string): string {
  const bars = trend
    .map((point, index) => {
      const x = 40 + index * 110;
      const barWidth = 56;
      const baseY = 150;
      const score = point.averageScore;
      const height = score === null ? 4 : Math.max(4, (score / 100) * 110);
      const barTop = baseY - height;
      const fill = score === null ? '#E0D9D0' : accent;
      const valueLabel = score === null ? '&mdash;' : `${score}%`;
      return `
        <g>
          <rect x="${x}" y="${barTop}" width="${barWidth}" height="${height}" rx="3" fill="${fill}" />
          <text x="${x + barWidth / 2}" y="${barTop - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#5C5849">${valueLabel}</text>
          <text x="${x + barWidth / 2}" y="${baseY + 18}" text-anchor="middle" font-size="9" letter-spacing="0.06em" fill="#7A7068">${escapeHtml(point.label)}</text>
        </g>`;
    })
    .join('');
  return `<svg width="460" height="180" viewBox="0 0 460 180" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

export function renderWeeklyReportHtml(data: WeeklyReportTemplateData): { html: string; footerTemplate: string } {
  const brand = data.brand ?? BRANDING_DEFAULTS;
  const { report } = data;
  const note = data.tutorNote || defaultNote(data.studentName);
  const avg = report.averageScorePercentage;
  const accent = brand.accent;

  const activityRows =
    report.activity.length === 0
      ? `<tr><td colspan="3" style="font-size: 13px; color: #5C5849; padding: 12px 0 4px;">No completed practice this week.</td></tr>`
      : report.activity
          .map(
            (row) => `
        <tr>
          <td>${escapeHtml(row.dateLabel)}</td>
          <td>${escapeHtml(row.topic)}</td>
          <td class="score">${row.score}%</td>
        </tr>`
          )
          .join('');

  const difficultyLine =
    report.difficultyPractised.length > 0 ? report.difficultyPractised.map(capitalizeDifficulty).join(', ') : '&mdash;';

  const topicChips =
    report.topicsPractised.length > 0
      ? report.topicsPractised.map((topic) => `<span class="chip">${escapeHtml(topic)}</span>`).join('')
      : '<span class="chip muted">No completed practice this week</span>';

  const hasSubSkills = report.subSkills.strengths.length > 0 || report.subSkills.weaknesses.length > 0;
  const strengthsList =
    report.subSkills.strengths.length > 0 ? report.subSkills.strengths.map(escapeHtml).join(', ') : '&mdash;';
  const weaknessesList =
    report.subSkills.weaknesses.length > 0 ? report.subSkills.weaknesses.map(escapeHtml).join(', ') : '&mdash;';

  const attentiveLine =
    report.attentive === null
      ? ''
      : report.attentive
        ? `<p class="attentive-line">&#10003; Attentive across this week&rsquo;s practice.</p>`
        : `<p class="attentive-line">Attentiveness: needs monitoring this week.</p>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>${printFontFaces()}</style>
<style>${REPORT_STYLES}</style>
</head>
<body>
  <div class="header-row-1" style="display: flex; align-items: baseline; justify-content: space-between;">
    <span class="wordmark" style="color: ${escapeHtml(accent)};">${escapeHtml(brand.name)}</span>
    <span class="doc-label">Weekly progress report</span>
  </div>
  <hr class="header-rule" style="color: ${escapeHtml(accent)}; border-color: ${escapeHtml(accent)};">

  <p class="student-name">${escapeHtml(data.studentName)}</p>
  <p class="period-line">Week ending ${escapeHtml(formatDate(new Date()))} &middot; ${escapeHtml(report.periodLabel)}</p>

  <p class="section-mark">This week's practice</p>
  <div class="data-grid">
    <div class="data-stat">
      <p class="data-label">Worksheets completed</p>
      <p class="data-num">${report.worksheetsCompleted}</p>
    </div>
    <div class="data-stat">
      <p class="data-label">Average score</p>
      <p class="data-num score-num" style="color: ${escapeHtml(accent)};">${avg === null ? '&mdash;' : `${avg}%`}</p>
    </div>
    <div class="data-stat">
      <p class="data-label">Days practised</p>
      <p class="data-num score-num">${report.daysPractised}</p>
    </div>
    <div class="data-stat">
      <p class="data-label">Practised at</p>
      <p class="data-value" style="color: #1A1A18;">${escapeHtml(difficultyLine)}</p>
    </div>
  </div>

  <div class="chips">${topicChips}</div>

  <p class="section-mark">Score trend</p>
  <div class="trend-wrap">${trendSvg(report.trend, accent)}</div>

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

  ${hasSubSkills ? `
  <p class="section-mark">Sub-skill mastery</p>
  <div class="data-grid">
    <div class="data-stat">
      <p class="data-label">Strengths</p>
      <p class="subskill-list">${strengthsList}</p>
    </div>
    <div class="data-stat">
      <p class="data-label">To work on</p>
      <p class="subskill-list">${weaknessesList}</p>
    </div>
  </div>
  ` : ''}

  <p class="section-mark">From your tutor</p>
  ${attentiveLine}
  <div class="note-block">
    <p>${escapeHtml(note)}</p>
    <p class="signoff">${escapeHtml(brand.name)}</p>
  </div>
</body>
</html>`;

  return { html, footerTemplate: buildFooterTemplate(brand.name) };
}