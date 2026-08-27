'use client';

// Phase B Wave 1 (B5-B6): shared mastery bar list. Hand-rolled Tailwind (no
// chart lib - house style), colour-coded per mastery level using the +Marking
// palette from globals.css so it reads consistently with the rest of the app.
import { CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import type { MasteryBar } from '@/lib/mastery/masteryView';

const LEVEL_STYLES: Record<MasteryBar['level'], { bar: string; label: string; labelText: string }> = {
  mastered: { bar: 'bg-[#1A3D2E]', label: 'text-[#1A3D2E]', labelText: 'Mastered' },
  strong: { bar: 'bg-[#2D6A4F]', label: 'text-[#2D6A4F]', labelText: 'Strong' },
  progressing: { bar: 'bg-[#C8A84B]', label: 'text-[#C8A84B]', labelText: 'Progressing' },
  weak: { bar: 'bg-[#C0392B]', label: 'text-[#C0392B]', labelText: 'Needs work' },
};

function LevelIcon({ level }: { level: MasteryBar['level'] }) {
  if (level === 'mastered' || level === 'strong') {
    return <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#1A3D2E]" strokeWidth={2} aria-hidden="true" />;
  }
  if (level === 'weak') {
    return <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#C0392B]" strokeWidth={2} aria-hidden="true" />;
  }
  return <TrendingUp className="w-3.5 h-3.5 shrink-0 text-[#C8A84B]" strokeWidth={2} aria-hidden="true" />;
}

export default function MasteryBars({ bars }: { bars: MasteryBar[] }) {
  if (bars.length === 0) {
    return (
      <p className="text-sm italic text-[#9A9080]">
        No mastery data yet - complete a few worksheets and your progress will appear here.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {bars.map((bar) => {
        const style = LEVEL_STYLES[bar.level];
        const width = bar.latestScore != null ? Math.max(4, Math.min(100, bar.latestScore)) : 0;
        return (
          <li key={bar.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm font-medium text-[#1A1A18] truncate">{bar.subSkill}</span>
                {bar.topic && <span className="text-xs text-[#9A9080] truncate">({bar.topic})</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-[#5C5849]">{bar.latestScore != null ? `${bar.latestScore}%` : '—'}</span>
                <span className={`flex items-center gap-1 text-[11px] ${style.label}`}>
                  <LevelIcon level={bar.level} />
                  {style.labelText}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E0D9D0]">
              <div className={`h-full rounded-full ${style.bar} transition-[width] duration-standard ease-premium`} style={{ width: `${width}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-[#9A9080]">
              <span>{bar.attempts} attempt{bar.attempts === 1 ? '' : 's'}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
