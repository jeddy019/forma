// Phase B Wave 1 (B8): a simple recent-scores bar chart. Hand-rolled Tailwind
// (no chart dependency - house style), colour-coded per score band using the
// same palette as the mastery bars. Pure display, rendered server-side (no
// hooks) so it fits the /student RSC without a client boundary.

export interface ScorePoint {
  dateLabel: string;
  score: number;
}

function barColour(score: number): string {
  if (score >= 85) return 'bg-[#1A3D2E]';
  if (score >= 50) return 'bg-[#C8A84B]';
  return 'bg-[#C0392B]';
}

export default function ScoresChart({ scores }: { scores: ScorePoint[] }) {
  if (scores.length === 0) {
    return <p className="text-sm italic text-[#9A9080]">No scores yet - complete a worksheet to see your progress.</p>;
  }

  return (
    <div className="flex items-end gap-2 h-28">
      {scores.map((point) => (
        <div key={point.dateLabel + point.score} className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <span className="text-[11px] text-[#5C5849]">{point.score}%</span>
          <div
            className={`w-full max-w-[40px] rounded-t-[4px] ${barColour(point.score)}`}
            style={{ height: `${Math.max(8, point.score)}%` }}
          />
          <span className="text-[10px] text-[#9A9080] truncate w-full text-center">{point.dateLabel}</span>
        </div>
      ))}
    </div>
  );
}
