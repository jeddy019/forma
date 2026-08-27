'use client';

// Phase B Wave 1 (B7): the student's spaced-repetition surface on the portal.
// Two parts:
//   1. "Due for review today" - tracked sub-skills whose schedule is due,
//      each with Pass/Fail buttons that advance (or reset) the SRS ladder.
//   2. Inline "Track for review" on any mastery bar not yet tracked - opt in
//      (CLAUDE.md: "student says master this").
// Identity: if one email matches several profiles (multiple tutors) the
// tracking/review actions apply to the FIRST matched profile - a documented
// simplification; the common case is a single profile.
import { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { cardClass, secondaryButtonClass, primaryButtonClass } from '@/lib/ui/formStyles';
import type { MasteryBar } from '@/lib/mastery/masteryView';

export interface ReviewInfo {
  tracked: boolean;
  due: boolean;
  nextIn?: string;
}

export default function SrsSection({
  studentIds,
  bars,
  reviewMap,
}: {
  studentIds: string[];
  bars: MasteryBar[];
  reviewMap: Record<string, ReviewInfo>;
}) {
  const [tracked, setTracked] = useState<Set<string>>(() => new Set(Object.keys(reviewMap).filter((k) => reviewMap[k].tracked)));
  const [dueSeen, setDueSeen] = useState<Set<string>>(() => new Set(Object.keys(reviewMap).filter((k) => reviewMap[k].due)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const studentId = studentIds[0];
  if (!studentId) return null;

  async function track(bar: MasteryBar) {
    if (!studentId || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/srs/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, subSkill: bar.key, subSkillLabel: bar.subSkill, topic: bar.topic }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not start tracking - please try again.');
      return;
    }
    setTracked((prev) => new Set(prev).add(bar.key));
  }

  async function review(bar: MasteryBar, passed: boolean) {
    if (!studentId || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/srs/reviewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, subSkill: bar.key, passed }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Could not record the review - please try again.');
      return;
    }
    // assume the next review is now in the future - drop from "due today"
    setDueSeen((prev) => {
      const next = new Set(prev);
      next.delete(bar.key);
      return next;
    });
  }

  const dueBars = bars.filter((b) => tracked.has(b.key) && dueSeen.has(b.key));
  const untrackedBars = bars.filter((b) => !tracked.has(b.key));

  return (
    <div className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-[#1A3D2E]" strokeWidth={2} aria-hidden="true" />
        <h2 className="text-base font-semibold text-[#1A1A18]">Spaced review</h2>
      </div>

      <div className="flex flex-col gap-3">
        {dueBars.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-[#1A1A18]">Due for review today</p>
            {dueBars.map((bar) => (
              <div key={bar.key} className="flex items-center justify-between gap-3 rounded-[10px] border border-[#E0D9D0] px-3 py-2">
                <span className="text-sm text-[#1A1A18]">{bar.subSkill}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busy} onClick={() => review(bar, true)} className={primaryButtonClass}>
                    <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" /> Got it
                  </button>
                  <button type="button" disabled={busy} onClick={() => review(bar, false)} className={secondaryButtonClass}>
                    Struggled
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : tracked.size > 0 ? (
          <p className="text-sm italic text-[#9A9080]">Nothing due today - come back tomorrow.</p>
        ) : null}

        {untrackedBars.length > 0 && (
          <div>
            <p className="text-sm text-[#5C5849] mb-2">
              Tap <span className="font-medium">Track</span> on a sub-skill to schedule reviews so it sticks.
            </p>
            <div className="flex flex-col gap-1.5">
              {untrackedBars.map((bar) => (
                <div key={bar.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#1A1A18]">{bar.subSkill}</span>
                  <button type="button" disabled={busy} onClick={() => track(bar)} className="text-sm text-[#1A3D2E] font-medium hover:underline disabled:opacity-50">
                    Track
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-[#C0392B]">{error}</p>}
      </div>
    </div>
  );
}
