'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { saveReportNoteAction, sendWeeklyReportAction } from './actions';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

// Phase B W2 (weekly branded proof report): the founder's control for each
// student. One textarea does two jobs - the standing note (saved via "Save",
// used on every auto-sent report) and this week's override (typed and sent
// in one click; a blank note falls back to the saved standing note). The
// W8 attentiveness check works the same way: a single checkbox is the
// standing value AND what this week's send uses, so the founder never has to
// re-enter it against a cron that fires Monday morning. No AI is involved
// anywhere - this note is the founder's own voice, verbatim (anti-swallow
// invariant).
export default function WeeklyReportForm({
  studentId,
  hasParentEmail,
  reportNote,
  reportAttentive,
  lastReportSentAt,
}: {
  studentId: string;
  hasParentEmail: boolean;
  reportNote: string | null;
  reportAttentive: boolean | null;
  lastReportSentAt: string | null;
}) {
  const [note, setNote] = useState(reportNote ?? '');
  const [attentive, setAttentive] = useState<boolean | null>(reportAttentive);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lastSentLabel = lastReportSentAt
    ? new Date(lastReportSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await saveReportNoteAction(studentId, note, attentive);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage('Saved - the note and attentiveness check will appear on every report from now on.');
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setMessage(null);
    const result = await sendWeeklyReportAction(studentId, note, attentive);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage('This week\'s report sent.');
  }

  return (
    <div className={`${accentCardClass} flex flex-col gap-3`}>
      <FormHeader icon={FileText} title="Weekly report" />

      {!hasParentEmail && (
        <p className="text-sm text-[#9A9080] italic">
          This student is not in a family with an email - add one from the Families page first.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2.5 mt-1" htmlFor="report-attentive">
          <input
            id="report-attentive"
            type="checkbox"
            checked={attentive === true}
            onChange={(event) => setAttentive(event.target.checked)}
            className="w-4 h-4 accent-[#1A3D2E] cursor-pointer"
          />
          <span className="text-sm text-[#1A1A18] font-medium">Attentive in sessions this week</span>
        </label>
        {attentive !== null && (
          <button
            type="button"
            onClick={() => setAttentive(null)}
            className="self-start text-xs text-[#9A9080] hover:text-[#1A3D2E] transition-colors duration-micro ease-premium"
          >
            Unmark - omit from the report
          </button>
        )}
        <p className="text-xs text-[#9A9080]">
          Shows as one line on the report - &quot;Attentive&quot; when checked, &quot;needs monitoring&quot; when unchecked, omitted
          entirely when left unmarked.
        </p>
      </div>

      <label className={labelClass} htmlFor="report-note">
        Your note for the parent
      </label>
      <textarea
        id="report-note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="A short line in your own words - what happened this week, what to watch next."
        className={inputClass}
      />

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleSend} disabled={sending || !hasParentEmail} className={primaryButtonClass}>
          {sending ? 'Sending...' : "Send this week's report"}
        </button>
        <button type="button" onClick={handleSave} disabled={saving} className={secondaryButtonClass}>
          {saving ? 'Saving...' : 'Save as defaults'}
        </button>
      </div>

      <p className="text-xs text-[#9A9080]">
        The report is a branded PDF (worksheets, scores, 4-week trend, topics, difficulty, sub-skill strengths, attentiveness
        check) plus this note. {lastSentLabel ? `Last sent ${lastSentLabel}.` : 'No report sent yet.'}
      </p>

      {message && <p className="text-sm text-[#1A3D2E]">{message}</p>}
      {error && <p className="text-sm text-[#C0392B]">{error}</p>}
    </div>
  );
}