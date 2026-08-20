import { escapeLatexOutsideMath } from './escapeLatex';
import { sectionDividerLabel } from '../worksheet/sectionDividerLabel';
import { formatDate } from './worksheet-template';
import type { MarkSchemeHeaderData, MarkSchemeQuestion, MarkSchemeQuestionPart, MarkSchemeTemplateData } from './mark-scheme-template';
import type { LatexRenderResult } from './worksheetLatexTemplate';

// Mirrors worksheetLatexTemplate.ts the same way mark-scheme-template.ts
// mirrors worksheet-template.ts today: its own copy of the page-level
// styling constants (deliberate, per that file's existing comment - the
// "Mark Scheme" suffix and dropped QR/cover-page make the two documents
// different enough that sharing a builder would need its own options-flags
// layer for what are, in practice, two short and stable templates). No
// diagrams here at all - MarkSchemeQuestionPart has no diagram_spec field.

const COLOR_DEFS = `\\definecolor{FPrimary}{HTML}{1A3D2E}
\\definecolor{FAccent}{HTML}{C8A84B}
\\definecolor{FTextPrimary}{HTML}{1A1A18}
\\definecolor{FTextSecondaryPrint}{HTML}{2E2A24}
\\definecolor{FTextMutedPrint}{HTML}{5C5849}
\\definecolor{FBorderDefault}{HTML}{E0D9D0}
\\definecolor{FBadgeBg}{HTML}{E8F2ED}
\\definecolor{FGreenTint}{HTML}{E8F2ED}`;

function paperGeometry(format: 'A4' | 'Letter'): string {
  const size = format === 'Letter' ? 'paperwidth=215.9mm,paperheight=279.4mm' : 'paperwidth=210mm,paperheight=297mm';
  return `\\usepackage[${size},top=20mm,bottom=20mm,left=22mm,right=22mm]{geometry}`;
}

// No explicit ItalicFont key - see worksheetLatexTemplate.ts's FONT_SETUP
// comment (both Inter font files share one family name, distinguished by
// style, so fontconfig resolves italic automatically).
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

const FOOTER_SETUP = `\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0.5pt}
\\renewcommand{\\footrule}{{\\color{FBorderDefault}\\vskip-3pt\\hrule height 0.5pt width\\headwidth\\vskip2.5pt}}
\\fancyfoot[L]{\\footnotesize\\color{FTextMutedPrint}Forma}
\\fancyfoot[R]{\\footnotesize\\color{FTextMutedPrint}\\thepage\\ of \\pageref{LastPage}}`;

function renderHeader(header: MarkSchemeHeaderData): string {
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

  return `\\noindent{\\headingfont\\fontsize{18}{22}\\selectfont\\color{FTextPrimary}${studentName}\\ \\ \\fontsize{13}{16}\\selectfont\\color{FTextSecondaryPrint}Mark Scheme}\\hfill{\\headingfont\\fontsize{11}{13}\\selectfont\\color{FPrimary}Forma}\\par
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

function renderPart(part: MarkSchemeQuestionPart, indented: boolean): string {
  const heading = indented
    ? `\\begin{minipage}[t]{0.87\\linewidth}\\raggedright{\\small\\textbf{(${escapeLatexOutsideMath(part.part_label ?? '')})}}\\end{minipage}\\hfill\\begin{minipage}[t]{0.09\\linewidth}\\raggedleft{\\footnotesize\\color{FTextMutedPrint}[${part.marks} ${part.marks === 1 ? 'mark' : 'marks'}]}\\end{minipage}\\par\n`
    : '';

  const line = (label: string, value: string) =>
    `{\\small\\textbf{\\color{FPrimary}${label}:}\\ \\color{FTextPrimary}${escapeLatexOutsideMath(value)}}\\\\[1mm]`;

  const box = `\\begin{tcolorbox}[colback=FGreenTint,colframe=FGreenTint,boxrule=0pt,arc=2mm,left=4mm,right=4mm,top=3mm,bottom=3mm]
${line('M1', part.M1)}
${line('A1', part.A1)}
${line('Answer', part.answer)}
${line('Allow', part.allow)}
${line('Common error', part.common_error)}
\\end{tcolorbox}`;

  const body = `${heading}${box}\\vspace{3mm}`;
  if (!indented) return body;
  return `\\begin{itemize}[leftmargin=4mm, label={}, itemsep=0pt, topsep=0pt]\\item ${body}\\end{itemize}`;
}

function renderQuestion(question: MarkSchemeQuestion, index: number, questions: MarkSchemeQuestion[]): string {
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
  const partsBlock = question.parts.map((part) => renderPart(part, isMultiPart)).join('\n');

  // Mark-scheme entries are shorter/denser than worksheet questions (no
  // working lines to size against), so a flat generous constant is enough -
  // no per-part formula needed the way the worksheet template's needs one.
  const needLines = 6 + question.parts.length * 6;

  return `${dividerBlock}\\needspace{${needLines}\\baselineskip}
\\vspace{2mm}
\\noindent\\begin{minipage}[t]{0.87\\linewidth}\\raggedright{\\small\\textbf{\\color{FPrimary}Q${index + 1}}}\\end{minipage}\\hfill\\begin{minipage}[t]{0.09\\linewidth}\\raggedleft{\\footnotesize\\color{FTextMutedPrint}[${totalMarks} ${totalMarks === 1 ? 'mark' : 'marks'}]}\\end{minipage}\\par
\\vspace{1.5mm}
${partsBlock}`;
}

export async function renderMarkSchemeLatex(data: MarkSchemeTemplateData, format: 'A4' | 'Letter' = 'A4'): Promise<LatexRenderResult> {
  const { header, questions } = data;
  const questionBlocks = questions.map((question, index) => renderQuestion(question, index, questions));

  const source = `\\documentclass[11pt]{article}
${paperGeometry(format)}
${FONT_SETUP}
${PREAMBLE_PACKAGES}
${COLOR_DEFS}
\\pagestyle{fancy}
\\setlength{\\parindent}{0pt}
\\begin{document}
${FOOTER_SETUP}
${renderHeader(header)}

${questionBlocks.join('\n\n')}
\\end{document}
`;

  return { source, images: [] };
}
