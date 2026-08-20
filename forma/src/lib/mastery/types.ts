// Phase 7 Step 38 (Zero to Mastery): student_profiles.skill_map's shape.
// The column existed since Phase 1 as an empty '{}'::jsonb with no reader
// or writer - this is the first thing to define what actually lives in it.

// Kumon Methodology, MASTERY BEFORE PROGRESSION (CLAUDE.md): "85% accuracy
// across two consecutive worksheets on the same sub-skill."
export const MASTERY_THRESHOLD = 85;
export const MASTERY_CONSECUTIVE = 2;

// Adaptive Difficulty's own "below 50%" downgrade threshold, reused here
// for RETURN TO FUNDAMENTALS (Step 41) - same number, different mechanism
// (routes to a prerequisite sub-skill instead of just downgrading).
export const FUNDAMENTALS_THRESHOLD = 50;

// Performance Rule 3 ("paginate/cap all lists") style cap - only the last
// two entries matter for the mastery threshold, a few more are kept for
// trend/display. Mirrors WORKSHEET_HISTORY_LIMIT's own reasoning elsewhere.
export const HISTORY_CAP = 10;

export interface SkillMapHistoryEntry {
  score: number;
  worksheetId: string;
  topic: string;
  at: string;
}

export interface SkillMapEntry {
  // Latest original (non-slugified) wording, for display/prompting - the
  // map's own keys are slugifySubSkill(subSkill) output, not this.
  subSkill: string;
  // Most-recent-last, capped at HISTORY_CAP.
  history: SkillMapHistoryEntry[];
  // Sticky: once true, stays true even after a later low score. Nothing in
  // Steps 37-42 as built gates progression on this yet (only
  // needsFundamentals is consumed, by Step 41) - revisit if a future
  // "block harder content until mastered" feature needs live-recompute
  // instead.
  mastered: boolean;
  masteredAt: string | null;
  // True iff the MOST RECENT entry in history scored below
  // FUNDAMENTALS_THRESHOLD. Recomputed on every new score for this
  // sub-skill (not sticky) - Step 41 clears it explicitly once a
  // fundamentals-routed worksheet has been generated for it.
  needsFundamentals: boolean;
}

export type SkillMap = Record<string, SkillMapEntry>;
