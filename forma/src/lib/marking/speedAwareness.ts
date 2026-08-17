// Pure logic for Phase 7 Step 39 (Speed awareness): "Flag to the tutor
// when a student achieves correct answers but takes significantly longer
// than expected. Speed and accuracy together indicate mastery." Same
// "pure logic gets its own file and tests" discipline as
// weeklySummary.ts/nextDifficulty.ts.
//
// "Significantly longer than expected" has no fixed number anywhere in
// CLAUDE.md - the only genuinely open question it names for this step is
// the capture mechanism (worksheets.first_opened_at resolves that, see
// the migration). SLOW_MULTIPLIER/CORRECT_THRESHOLD below are this
// session's own reasonable starting values, not a documented spec - both
// are simple, isolated constants a future session (or the user) can
// retune without touching the comparison logic itself.
export const SLOW_MULTIPLIER = 1.5;
export const CORRECT_THRESHOLD = 70;

export interface TimedSubmission {
  worksheetId: string;
  timeTakenSeconds: number | null;
}

export interface SpeedFlagInput extends TimedSubmission {
  scorePercentage: number | null;
}

export interface SpeedFlag {
  isSlow: boolean;
  averageSeconds: number | null;
}

// peers: other scored submissions on the same subject+topic, for context
// on what "expected" looks like - the caller decides that scoping (see
// marking/[id]/page.tsx), this function only does the comparison.
export function computeSpeedFlag(target: SpeedFlagInput, peers: TimedSubmission[]): SpeedFlag {
  if (target.timeTakenSeconds === null || target.scorePercentage === null || target.scorePercentage < CORRECT_THRESHOLD) {
    return { isSlow: false, averageSeconds: null };
  }

  const comparablePeers = peers.filter((p) => p.worksheetId !== target.worksheetId && p.timeTakenSeconds !== null);
  if (comparablePeers.length === 0) {
    return { isSlow: false, averageSeconds: null };
  }

  const total = comparablePeers.reduce((sum, p) => sum + (p.timeTakenSeconds as number), 0);
  const averageSeconds = Math.round(total / comparablePeers.length);

  return { isSlow: target.timeTakenSeconds > averageSeconds * SLOW_MULTIPLIER, averageSeconds };
}
