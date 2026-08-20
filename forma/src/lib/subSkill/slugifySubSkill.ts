// Phase 7 Steps 38/42: the AI is taught (systemPrompt.ts) to name sub-skills
// consistently across generations, but that's a prompt instruction, not a
// guarantee - this normalizes best-effort so "Elimination Method" and
// "elimination method" land on the same student_profiles.skill_map key /
// the same question_bank match, rather than silently forking into two.
export function slugifySubSkill(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
