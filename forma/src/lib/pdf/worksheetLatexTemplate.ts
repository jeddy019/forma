import qrcode from 'qrcode-generator';
import sharp from 'sharp';
import { escapeLatexOutsideMath } from './escapeLatex';
import { renderDiagramToPng, RASTER_DENSITY } from './diagramToImage';
import { sectionDividerLabel } from '../worksheet/sectionDividerLabel';
import { formatDate, type WorksheetHeaderData, type WorksheetQuestion, type WorksheetQuestionPart, type WorksheetTemplateData } from './worksheet-template';

// Replaces renderWorksheetHtml's role. worksheet-template.ts itself is kept
// (trimmed, not deleted) for its shared types/utilities - see that file's
// top comment. This produces LaTeX source + an image manifest instead of an
// HTML string; latexClient.ts sends both to the self-hosted compile service.

export interface LatexRenderResult {
  source: string;
  images: { filename: string; buffer: Buffer }[];
}

// ---------------------------------------------------------------------------
// Palette - a PDF-only, print-safe colour set, deliberately separate from
// src/lib/diagrams/colors.ts (shared with the live SVG/web view, screen-
// tuned) and from the app's own CSS custom properties. Darker floor values
// per the printed-PDF requirement that no readable text go lighter than
// #5C5849 - the app's on-screen #9A9080 "muted" token is too light once
// printed, so nothing in this file uses it. Kept in sync with these values
// manually; there is no shared source of truth between this string
// template and the TS colour constants elsewhere in the app - see
// CLAUDE.md's "Diagram Colour System" note on this same seam.
// ---------------------------------------------------------------------------
const COLOR_DEFS = `\\definecolor{FPrimary}{HTML}{1A3D2E}
\\definecolor{FAccent}{HTML}{C8A84B}
\\definecolor{FTextPrimary}{HTML}{1A1A18}
\\definecolor{FTextSecondaryPrint}{HTML}{2E2A24}
\\definecolor{FTextMutedPrint}{HTML}{5C5849}
\\definecolor{FWorkingLine}{HTML}{7A7068}
\\definecolor{FBorderDefault}{HTML}{E0D9D0}
\\definecolor{FBadgeBg}{HTML}{E8F2ED}`;

function paperGeometry(format: 'A4' | 'Letter'): string {
  const size = format === 'Letter' ? 'paperwidth=215.9mm,paperheight=279.4mm' : 'paperwidth=210mm,paperheight=297mm';
  return `\\usepackage[${size},top=20mm,bottom=20mm,left=22mm,right=22mm]{geometry}`;
}

// See latex-service/README.md's "Fonts" section - this variable-font axis
// syntax follows the documented fontspec manual approach but has not been
// compiled/visually verified (no LaTeX toolchain was available to test
// with). Verify real weight/italic rendering on first deploy.
//
// No explicit ItalicFont key: inspected both font files' own name tables
// directly (fontTools) rather than assuming - Inter-Variable.ttf and
// Inter-Italic-Variable.ttf both register under the SAME family name
// "Inter" (nameID 1), distinguished by style ("Regular" vs "Italic" in
// nameID 2), not two separate families. fontconfig/fontspec resolve
// \itshape's italic slant automatically from that style bit once both
// files are registered (fc-cache, in the Dockerfile) - an explicit
// ItalicFont pointing at a fabricated "Inter Italic" family name would
// have silently failed to resolve.
const FONT_SETUP = `\\usepackage{fontspec}
\\setmainfont{Inter}[
  UprightFont = {*[wght=400]},
  BoldFont = {*[wght=600]},
]
\\newfontfamily\\headingfont{Playfair Display}[UprightFont={*[wght=600]}]`;

const PREAMBLE_PACKAGES = `\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{xcolor}
\\usepackage{enumitem}
\\usepackage{tcolorbox}
\\tcbuselibrary{skins}
\\usepackage{needspace}
\\usepackage{graphicx}
\\usepackage{siunitx}
\\usepackage{mhchem}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\usepackage{parskip}`;

function mmFromPx(px: number): number {
  return (px * 25.4) / RASTER_DENSITY;
}

// ---------------------------------------------------------------------------
// Footer - kept to the existing documented spec (page number IN the footer,
// not moved to the header - a pasted alternate spec proposed the opposite,
// not adopted, see the plan this file implements). Repeats on every page
// via fancyhdr, since it's the one piece of the layout that genuinely
// repeats per page; everything else is normal document flow.
// ---------------------------------------------------------------------------
const FOOTER_SETUP = `\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0.5pt}
\\renewcommand{\\footrule}{{\\color{FBorderDefault}\\vskip-3pt\\hrule height 0.5pt width\\headwidth\\vskip2.5pt}}
\\fancyfoot[L]{\\footnotesize\\color{FTextMutedPrint}Forma}
\\fancyfoot[R]{\\footnotesize\\color{FTextMutedPrint}\\thepage\\ of \\pageref{LastPage}}`;

// ---------------------------------------------------------------------------
// Cover page - new content, not present in the pre-LaTeX product at all.
// Platform-only branding (no personal name), no Final Score row (nothing to
// show at generation time), no \pagecolor (visual distinction comes from
// typography/rules, not a background tint - printed paper, not a screen
// surface the "never pure white on the interface" app rule was aimed at).
// ---------------------------------------------------------------------------
function renderCoverPage(header: WorksheetHeaderData): string {
  const studentName = escapeLatexOutsideMath(header.studentName);
  const subject = escapeLatexOutsideMath(header.subject);
  const topic = escapeLatexOutsideMath(header.topic);
  const curriculumBadge = escapeLatexOutsideMath(header.curriculumBadge);
  const yearOrGradeBadge = escapeLatexOutsideMath(header.yearOrGradeBadge);
  const dateStr = formatDate(header.createdAt);

  return `\\thispagestyle{empty}
\\vspace*{18mm}
\\begin{center}
  {\\headingfont\\fontsize{13}{16}\\selectfont\\color{FPrimary}Forma}\\\\[14mm]
  {\\headingfont\\fontsize{30}{36}\\selectfont\\color{FTextPrimary}${subject}}\\\\[3mm]
  {\\headingfont\\fontsize{20}{24}\\selectfont\\color{FTextSecondaryPrint}${topic}}
\\end{center}
\\vspace{14mm}

\\begin{tcolorbox}[colback=FBadgeBg,colframe=FBorderDefault,boxrule=0.5pt,arc=2mm,left=6mm,right=6mm,top=4mm,bottom=4mm]
\\begin{tabular}{@{}p{0.32\\linewidth}p{0.32\\linewidth}p{0.32\\linewidth}@{}}
{\\small\\color{FTextMutedPrint}Name}\\\\[1mm]{\\color{FTextPrimary}${studentName}} &
{\\small\\color{FTextMutedPrint}Year group}\\\\[1mm]{\\color{FTextPrimary}${yearOrGradeBadge}} &
{\\small\\color{FTextMutedPrint}Date}\\\\[1mm]{\\color{FTextPrimary}${dateStr}} \\\\
\\end{tabular}
\\end{tcolorbox}
\\vspace{6mm}

{\\small\\color{FTextMutedPrint}${curriculumBadge} \\textbullet\\ Suggested pace: work through steadily, there is no fixed time limit.}
\\vspace{10mm}

{\\small\\color{FTextSecondaryPrint}\\textbf{Before you start}}
\\begin{itemize}[leftmargin=6mm, itemsep=1mm, topsep=2mm, label=\\textcolor{FAccent}{\\textbullet}]
  \\item{\\small\\color{FTextSecondaryPrint}Answer all questions.}
  \\item{\\small\\color{FTextSecondaryPrint}Show your working in the space provided.}
  \\item{\\small\\color{FTextSecondaryPrint}Write clearly in black or blue ink.}
  \\item{\\small\\color{FTextSecondaryPrint}Diagrams are not drawn to scale unless stated.}
  \\item{\\small\\color{FTextSecondaryPrint}Check your answers before finishing.}
\\end{itemize}

\\vfill
\\begin{center}
{\\small\\color{FTextMutedPrint}This assignment was built by Forma, a personalised practice platform.}\\\\
{\\small\\color{FTextMutedPrint}forma.app}
\\end{center}
\\clearpage`;
}

// ---------------------------------------------------------------------------
// Header (post-cover, start of question content) - reproduces the existing
// documented Row 1-5 spec exactly, just as LaTeX instead of HTML.
// ---------------------------------------------------------------------------
function renderHeader(header: WorksheetHeaderData): string {
  const studentName = escapeLatexOutsideMath(header.studentName);
  const subject = escapeLatexOutsideMath(header.subject);
  const topic = escapeLatexOutsideMath(header.topic);
  const curriculumBadge = escapeLatexOutsideMath(header.curriculumBadge);
  const yearOrGradeBadge = escapeLatexOutsideMath(header.yearOrGradeBadge);
  const alignmentNoteText = escapeLatexOutsideMath(
    header.alignmentNote ?? `Questions are appropriate for ${header.curriculumLevelForFallback} ${header.subject}.`
  );
  const dateStr = formatDate(header.createdAt);

  const badge = (text: string) => `{\\small\\color{FPrimary}\\colorbox{FBadgeBg}{\\strut\\ ${text}\\ }}`;

  return `\\noindent{\\headingfont\\fontsize{18}{22}\\selectfont\\color{FTextPrimary}${studentName}}\\hfill{\\headingfont\\fontsize{11}{13}\\selectfont\\color{FPrimary}Forma}\\par
\\vspace{2mm}
{\\color{FPrimary}\\rule{\\linewidth}{1.4pt}}\\par
\\vspace{2.5mm}
\\noindent ${badge(curriculumBadge)}\\ \\ ${badge(yearOrGradeBadge)}\\ \\ ${badge(subject)}\\par
\\vspace{2mm}
\\noindent{\\footnotesize\\itshape\\color{FTextMutedPrint}${alignmentNoteText}}\\par
\\vspace{1mm}
\\noindent{\\small\\color{FTextMutedPrint}${topic} - ${dateStr}}\\par
\\vspace{5mm}`;
}

// ---------------------------------------------------------------------------
// Questions / parts
// ---------------------------------------------------------------------------

function workingLines(count: number): string {
  const lines = Math.max(1, count);
  // A plain hairline per line, no label - matches the existing product's
  // "Working lines are plain horizontal rules only. No label." spec exactly.
  const rule = `{\\color{FWorkingLine}\\rule{\\linewidth}{0.4pt}}`;
  return Array.from({ length: lines }, () => rule).join('\\\\[3.8mm]\n');
}

async function renderPart(
  part: WorksheetQuestionPart,
  indented: boolean,
  filenamePrefix: string,
  images: { filename: string; buffer: Buffer }[]
): Promise<string> {
  const label = part.part_label ? `\\textbf{(${escapeLatexOutsideMath(part.part_label)})}\\ ` : '';
  const text = escapeLatexOutsideMath(part.text);

  let diagramBlock = '';
  if (part.diagram_spec) {
    const rasterized = await renderDiagramToPng(part.diagram_spec);
    if (rasterized) {
      const filename = `${filenamePrefix}.png`;
      images.push({ filename, buffer: rasterized.buffer });
      const widthMm = Math.min(mmFromPx(rasterized.widthPx), 120); // never wider than a sane fraction of the text block
      diagramBlock = `\\begin{center}\\includegraphics[width=${widthMm.toFixed(1)}mm]{${filename}}\\end{center}\\vspace{2mm}\n`;
    }
  }

  const body = `\\begin{minipage}[t]{0.87\\linewidth}\\raggedright{\\small\\color{FTextPrimary}${label}${text}}\\end{minipage}\\hfill\\begin{minipage}[t]{0.09\\linewidth}\\raggedleft{\\footnotesize\\color{FTextMutedPrint}[${part.marks}]}\\end{minipage}\\par
${diagramBlock}\\vspace{2.5mm}
{\\color{FBorderDefault}\\rule{\\linewidth}{0.5pt}}\\\\[2.5mm]
${workingLines(part.working_lines)}
\\vspace{3mm}`;

  if (!indented) return body;
  return `\\begin{itemize}[leftmargin=4mm, label={}, itemsep=0pt, topsep=0pt]\\item ${body}\\end{itemize}`;
}

async function renderQuestion(
  question: WorksheetQuestion,
  index: number,
  questions: WorksheetQuestion[],
  images: { filename: string; buffer: Buffer }[]
): Promise<string> {
  const divider = sectionDividerLabel(question, index, questions);
  const dividerBlock = divider
    ? `\\needspace{10\\baselineskip}
\\vspace{4mm}
{\\small\\color{${divider === 'Warm-up' ? 'FAccent' : 'FPrimary'}}\\uppercase{${divider}}}\\\\[1mm]
{\\color{FBorderDefault}\\rule{\\linewidth}{0.5pt}}\\\\[3mm]
`
    : '';

  const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
  const isMultiPart = question.parts.length > 1;

  // needspace estimate per the pasted spec's own formula (working_lines*2 + 8
  // baselineskip units), summed across every part of this question - a
  // deliberately generous estimate: \needspace only pushes to the next page
  // when insufficient room remains, so overestimating costs a little blank
  // space at worst, while underestimating risks the exact split-question bug
  // this exists to prevent.
  const needLines = question.parts.reduce((sum, part) => sum + part.working_lines * 2 + 8, 0);

  const partsHtml: string[] = [];
  for (let partIndex = 0; partIndex < question.parts.length; partIndex++) {
    partsHtml.push(await renderPart(question.parts[partIndex], isMultiPart, `q${index + 1}-p${partIndex}`, images));
  }

  return `${dividerBlock}\\needspace{${needLines}\\baselineskip}
\\vspace{2mm}
\\noindent\\begin{minipage}[t]{0.87\\linewidth}\\raggedright{\\small\\textbf{\\color{FPrimary}Q${index + 1}}}\\end{minipage}\\hfill\\begin{minipage}[t]{0.09\\linewidth}\\raggedleft{\\footnotesize\\color{FTextMutedPrint}[${totalMarks}]}\\end{minipage}\\par
\\vspace{1.5mm}
${partsHtml.join('\n')}`;
}

// ---------------------------------------------------------------------------
// QR code - rasterized the same way diagrams are, fixed 40x40mm regardless
// of intrinsic size (matching the existing spec's fixed physical size).
// ---------------------------------------------------------------------------
async function renderQrBlock(digitalCode: string, images: { filename: string; buffer: Buffer }[]): Promise<string> {
  const qr = qrcode(0, 'M');
  qr.addData(`https://forma.app/s/${digitalCode}`);
  qr.make();
  const svg = qr.createSvgTag({ scalable: true, margin: 0 });
  const buffer = await sharp(Buffer.from(svg), { density: RASTER_DENSITY }).png().toBuffer();
  const filename = 'qr-code.png';
  images.push({ filename, buffer });

  const label = escapeLatexOutsideMath(`Complete this digitally at forma.app/s/${digitalCode}`);
  return `\\vspace{6mm}
\\begin{flushright}
\\includegraphics[width=40mm,height=40mm]{${filename}}\\\\[1mm]
{\\footnotesize\\color{FTextMutedPrint}${label}}
\\end{flushright}`;
}

// ---------------------------------------------------------------------------
// Document assembly
// ---------------------------------------------------------------------------
export async function renderWorksheetLatex(data: WorksheetTemplateData, format: 'A4' | 'Letter' = 'A4'): Promise<LatexRenderResult> {
  const { header, questions } = data;
  const images: { filename: string; buffer: Buffer }[] = [];

  const questionBlocks: string[] = [];
  for (let index = 0; index < questions.length; index++) {
    questionBlocks.push(await renderQuestion(questions[index], index, questions, images));
  }

  const qrBlock = await renderQrBlock(header.digitalCode, images);

  const source = `\\documentclass[11pt]{article}
${paperGeometry(format)}
${FONT_SETUP}
${PREAMBLE_PACKAGES}
${COLOR_DEFS}
\\pagestyle{fancy}
\\setlength{\\parindent}{0pt}
\\begin{document}
${renderCoverPage(header)}
${FOOTER_SETUP}
${renderHeader(header)}

${questionBlocks.join('\n\n')}

${qrBlock}
\\end{document}
`;

  return { source, images };
}
