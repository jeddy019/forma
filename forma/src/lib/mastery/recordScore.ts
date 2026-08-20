import type { SupabaseClient } from '@supabase/supabase-js';
import { DIFFICULTY_LEVELS, type DifficultyLevel } from '@/lib/constants';
import { nextDifficulty } from '@/lib/adaptive/nextDifficulty';
import { accumulateBySubSkill, type SubSkillPartEntry } from './accumulateBySubSkill';
import { updateSkillMap } from './updateSkillMap';
import type { SkillMap } from './types';

export interface RecordScoreResult {
  // Adaptive Difficulty: "Show notice: 'Difficulty adjusted based on recent
  // performance.'" - unchanged contract from the two call sites this
  // replaces.
  difficultyNotice?: string;
}

// Phase 7 Step 38: replaces the fetch-current -> nextDifficulty -> update
// block that existed verbatim in both dashboard/marking/[id]/actions.ts and
// api/submit/route.ts, adding student_profiles.skill_map tracking
// alongside the existing current_difficulty dial (not instead of it - see
// nextDifficulty.ts's own note: Phase 7 layers per-sub-skill mastery on top,
// it doesn't rip out the whole-student fallback that pre-Step-37 worksheets
// with no sub_skill still need). Accepts a generic SupabaseClient so both
// the RLS'd server client (tutor path) and the service-role admin client
// (auto-finalize path) can call this the same way.
export async function recordScore(
  supabase: SupabaseClient,
  studentId: string,
  worksheetId: string,
  topic: string,
  scorePercentage: number,
  subSkillParts: SubSkillPartEntry[]
): Promise<RecordScoreResult> {
  const { data: studentRow } = await supabase.from('student_profiles').select('current_difficulty, skill_map').eq('id', studentId).single();

  const rawCurrent = studentRow?.current_difficulty;
  const currentDifficulty: DifficultyLevel = (DIFFICULTY_LEVELS as readonly string[]).includes(rawCurrent ?? '')
    ? (rawCurrent as DifficultyLevel)
    : 'standard';
  const updatedDifficulty = nextDifficulty(currentDifficulty, scorePercentage);

  const currentSkillMap: SkillMap = (studentRow?.skill_map as SkillMap) ?? {};
  const bySubSkill = accumulateBySubSkill(subSkillParts);
  const at = new Date().toISOString();
  const scores = Object.values(bySubSkill)
    .filter((totals) => totals.available > 0)
    .map((totals) => ({
      subSkill: totals.label,
      topic,
      scorePercentage: Math.round((totals.awarded / totals.available) * 100),
      worksheetId,
      at,
    }));
  const updatedSkillMap = scores.length > 0 ? updateSkillMap(currentSkillMap, scores) : currentSkillMap;

  const update: Record<string, unknown> = { skill_map: updatedSkillMap };
  if (updatedDifficulty) {
    update.current_difficulty = updatedDifficulty;
  }
  await supabase.from('student_profiles').update(update).eq('id', studentId);

  return { difficultyNotice: updatedDifficulty ? 'Difficulty adjusted based on recent performance.' : undefined };
}
