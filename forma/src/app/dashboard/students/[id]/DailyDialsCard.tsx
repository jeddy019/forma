'use client';

import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { saveDailyDialsAction } from './actions';
import { FormHeader } from '@/lib/ui/FormHeader';
import { accentCardClass, inputClass, labelClass, primaryButtonClass } from '@/lib/ui/formStyles';
import type { PracticeVolume, DifficultyPosture, HolidayPosture } from '@/lib/daily/dailyDialPlan';

// W8 Wave D (automatic daily quiz): the founder's per-student automation
// dials - how much practice, at what difficulty posture, and the current
// holiday posture. Founder-side only (PRODUCT EXPERIENCE MODEL): a parent
// asking for "more" gets the founder flipping these dials, never a control
// of their own; a student never sees them.
//
// W5 B77 (accuracy-required mode): the same card hosts the per-student
// accuracy switch - when on, the quiz player blocks the review screen until
// every wrong sub-skill is re-practised correctly. One switch, one line.
export default function DailyDialsCard({
  studentId,
  practiceVolume,
  difficultyPosture,
  holidayPosture,
  accuracyRequired,
  lastDailyGeneratedAt,
}: {
  studentId: string;
  practiceVolume: PracticeVolume;
  difficultyPosture: DifficultyPosture;
  holidayPosture: HolidayPosture;
  accuracyRequired: boolean;
  lastDailyGeneratedAt: string | null;
}) {
  const [volume, setVolume] = useState<PracticeVolume>(practiceVolume);
  const [posture, setPosture] = useState<DifficultyPosture>(difficultyPosture);
  const [holiday, setHoliday] = useState<HolidayPosture>(holidayPosture);
  const [accuracy, setAccuracy] = useState<boolean>(accuracyRequired);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lastGeneratedLabel = lastDailyGeneratedAt
    ? new Date(lastDailyGeneratedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await saveDailyDialsAction(studentId, volume, posture, holiday, accuracy);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage('Saved - applies from the student\'s next practice.');
  }

  return (
    <div className={`${accentCardClass} flex flex-col gap-3`}>
      <FormHeader icon={CalendarClock} title="Daily practice" />

      <p className="text-sm text-[#5C5849]">
        One automatic quiz each morning, personalised to {lastGeneratedLabel ? `the current weakness (last generated ${lastGeneratedLabel})` : 'the student\'s current weakness'}.
        No warm-up, no challenge - just focused daily practice.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor={`daily-volume-${studentId}`}>
            Daily volume
          </label>
          <select
            id={`daily-volume-${studentId}`}
            value={volume}
            onChange={(event) => setVolume(event.target.value as PracticeVolume)}
            className={inputClass}
          >
            <option value="light">Light - 5 questions</option>
            <option value="standard">Standard - 10 (5 for higher-tier)</option>
            <option value="deep">Deep - 15 questions</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor={`daily-posture-${studentId}`}>
            Difficulty posture
          </label>
          <select
            id={`daily-posture-${studentId}`}
            value={posture}
            onChange={(event) => setPosture(event.target.value as DifficultyPosture)}
            className={inputClass}
          >
            <option value="match">Match their level</option>
            <option value="push">Push one tier harder</option>
            <option value="consolidate">Consolidate what they know</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor={`daily-holiday-${studentId}`}>
            Holiday posture
          </label>
          <select
            id={`daily-holiday-${studentId}`}
            value={holiday}
            onChange={(event) => setHoliday(event.target.value as HolidayPosture)}
            className={inputClass}
          >
            <option value="normal">Normal practice</option>
            <option value="light">Light - 5 moderate, no push</option>
            <option value="paused">Paused - nothing auto-generated</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-[#9A9080]">
        Manual only - term dates differ across the countries, so holidays are never auto-detected.
      </p>

      <label className="mt-1 flex items-start justify-between gap-3 border-t border-[#E0D9D0] pt-3 cursor-pointer select-none">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-[#1A1A18]">Accuracy required</span>
          <span className="text-xs text-[#5C5849]">
            Wrong answers must be re-practised until correctly answered before the student moves on.
          </span>
        </span>
        <input
          type="checkbox"
          checked={accuracy}
          onChange={(event) => setAccuracy(event.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#C4B9AC] accent-[#1A3D2E] cursor-pointer"
          aria-label={`Accuracy required for ${studentId}`}
        />
      </label>

      <div className="flex items-center gap-3">
        <button type="button" onClick={handleSave} disabled={saving} className={primaryButtonClass}>
          {saving ? 'Saving...' : 'Save settings'}
        </button>
        {message && <p className="text-sm text-[#1A3D2E]">{message}</p>}
      </div>

      {error && <p className="text-sm text-[#C0392B]">{error}</p>}
    </div>
  );
}