// W5 B75 (cram mode): shared constants and the player-facing cram metadata
// shape, kept here so the generation route, the /q/[code] page and the
// QuizForm player all agree on one canonical time limit instead of drifting
// copies. Pure - no I/O.

export const CRAM_QUESTION_COUNT = 20;

// Exam-week pacing: ~90 seconds per question across the 20-question board.
// The player counts down from this and auto-submits the answers collected so
// far when it reaches zero (the number a student actually reached is what the
// review reflects - honestly, not artificially extended).
export const CRAM_TIME_LIMIT_MIN = 30;
export const CRAM_TIME_LIMIT_SEC = CRAM_TIME_LIMIT_MIN * 60;

export interface CramMeta {
  timeLimitSeconds: number;
}
