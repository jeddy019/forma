import type { GeneratedWorksheet } from './schema';

// worksheets.questions_json must never carry mark_scheme OR answer content
// (see Security Rules 1) - both get split into mark_scheme_json instead.
// This matters beyond the mark scheme PDF: the /s/[code] route sends the
// entire questions_json blob to students, so leaving "answer" in it would
// hand students the correct answer before they attempt the question - a
// real gap in the original schema draft, where "answer" was a sibling of
// "mark_scheme" rather than part of it.
export function splitMarkScheme(worksheet: GeneratedWorksheet) {
  const questionsJson = {
    ...worksheet,
    questions: worksheet.questions.map((question) => ({
      ...question,
      parts: question.parts.map((part) => ({
        part_label: part.part_label,
        text: part.text,
        marks: part.marks,
        diagram_spec: part.diagram_spec,
        working_lines: part.working_lines,
      })),
    })),
  };

  const markSchemeJson = {
    questions: worksheet.questions.map((question) => ({
      id: question.id,
      parts: question.parts.map((part) => ({
        part_label: part.part_label,
        marks: part.marks,
        answer: part.answer,
        ...part.mark_scheme,
      })),
    })),
  };

  return { questionsJson, markSchemeJson };
}
