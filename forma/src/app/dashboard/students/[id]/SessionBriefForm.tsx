'use client';

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { accentCardClass, primaryButtonClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

// Phase B W3 (session brief): the founder's "Prep for next session" control.
// One button streams the branded prep PDF (recent practice + the founder's
// own last session note, verbatim) in a new tab - no email, no storage. The
// card is founder-facing and reads only what the founder already owns.
export default function SessionBriefForm({
  studentId,
  lastNoteDateLabel,
}: {
  studentId: string;
  lastNoteDateLabel: string | null;
}) {
  const [opening, setOpening] = useState(false);

  function handlePrep() {
    setOpening(true);
    window.open(`/api/session-brief/${studentId}/pdf`, '_blank', 'noopener');
    window.setTimeout(() => setOpening(false), 1000);
  }

  return (
    <div className={`${accentCardClass} flex flex-col gap-3`}>
      <FormHeader icon={ClipboardList} title="Session brief" />

      <p className="text-sm text-[#5C5849]">
        A one-page brief for your next session: practice completed since your last note, scores, and
        {lastNoteDateLabel ? ` your note from ${lastNoteDateLabel}` : ' your last session note'} - verbatim, in one
        branded PDF.
      </p>
      {!lastNoteDateLabel && (
        <p className="text-sm text-[#9A9080] italic">
          No session note recorded yet - this brief will cover the last 7 days, and will read your practice since the
          note once you record one.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handlePrep} disabled={opening} className={primaryButtonClass}>
          {opening ? 'Preparing...' : 'Prep for next session'}
        </button>
      </div>
    </div>
  );
}