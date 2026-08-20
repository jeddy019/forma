import type { GeneratedWorksheet } from './schema';

// worksheets.questions_json must never carry mark_scheme OR answer content
// (see Security Rules 1) - both get split into mark_scheme_json instead.
// This matters beyond the mark scheme PDF: the /s/[code] route sends the
// entire questions_json blob to students, so leaving "answer" in it would
// hand students the correct answer before they attempt the question - a
// real gap in the original schema draft, where "answer" was a sibling of
// "mark_scheme" rather than part of it.
//
// answer_format travels with mark_scheme_json for the same reason, not with
// questions_json: /api/submit's Tier 1/Tier 2 marking (src/lib/marking/) is
// the only reader, and it already needs the service-role-only mark_scheme
// data to mark anything, so there's no reason for answer_format to exist
// anywhere a student's browser can reach it. This was missed when
// answer_format was added to the schema in Phase 3 Step 16 - this function
// predates that change and wasn't updated, so every part.answer_format
// silently ended up undefined in both stored JSON blobs, which meant Tier 1
// auto-marking never actually ran against a real submitted worksheet (its
// switch on answer_format matched no case) and Tier 2 never fired at all
// (its `=== 'extended'` check was always false). Found and fixed at the
// start of the Step 18 session, before building the marking dashboard on
// top of data that was never actually being populated.
export function splitMarkScheme(worksheet: GeneratedWorksheet) {
  const questionsJson = {
    ...worksheet,
    questions: worksheet.questions.map((question) => ({
      // ...question keeps id/type/sub_skill automatically - sub_skill
      // (Phase 7 Step 37) is not answer-revealing, so it's fine for the
      // student-safe half, unlike answer/mark_scheme below.
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
      // Needed by mark-scheme-template.ts to reproduce the same
      // Warm-up/Challenge section dividers as the worksheet - mark schemes
      // walk the same 10 questions in the same order.
      type: question.type,
      // Phase 7 Step 38 needs this server-side (mastery aggregation reads
      // questions_json's copy instead - see /api/submit's own comment -
      // but this copy exists too so any future mark-scheme-only consumer
      // doesn't have to round-trip through questions_json for it).
      sub_skill: question.sub_skill,
      parts: question.parts.map((part) => ({
        part_label: part.part_label,
        marks: part.marks,
        answer: part.answer,
        answer_format: part.answer_format,
        ...part.mark_scheme,
      })),
    })),
  };

  return { questionsJson, markSchemeJson };
}
