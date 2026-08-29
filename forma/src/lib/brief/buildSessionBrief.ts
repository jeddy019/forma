// Phase B W3 (session brief): before-session prep for the founder. The brief
// covers a student's practice since the founder's last recorded session note,
// falling back to the last 7 days when no note exists. The aggregation itself
// reuses buildWeeklyReport wholesale (src/lib/report/buildWeeklyReport.ts) so
// a founder reading a brief and a weekly report never sees two different
// numbers for the same period - the only thing special to the brief is the
// window it reads and the founder's own last note shown verbatim. No AI is
// involved anywhere in this feature; the "voice" of the brief is the
// founder's own words, passed through untouched.

export interface SessionBriefNote {
  content: string;
  /** ISO timestamp, used only for the date label in the PDF. */
  createdAt: string;
}

export interface BriefWindow {
  sinceIso: string;
  /** Human label, e.g. "Practice since 24 August" or "Practice this week". */
  windowLabel: string;
  /** True when anchored on a real session note, false for the 7-day fallback. */
  anchoredOnNote: boolean;
}

const FALLBACK_DAYS = 7;

function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date);
}

export function sessionBriefWindow(lastNoteAt: string | null, now: Date = new Date()): BriefWindow {
  if (lastNoteAt) {
    const since = new Date(lastNoteAt);
    return {
      sinceIso: since.toISOString(),
      windowLabel: `Practice since ${formatLongDate(since)}`,
      anchoredOnNote: true,
    };
  }
  const since = new Date(now.getTime() - FALLBACK_DAYS * 24 * 60 * 60 * 1000);
  return { sinceIso: since.toISOString(), windowLabel: 'Practice this week', anchoredOnNote: false };
}