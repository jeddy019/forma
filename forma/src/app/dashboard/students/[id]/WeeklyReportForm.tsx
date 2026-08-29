'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { saveReportNoteAction, sendWeeklyReportAction } from './actions';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

// Phase B W2 (weekly branded proof report): the founder's control for each
// student. One textarea does two jobs - the standing note (saved via "Save
// note", used on every auto-sent report) and this week's override (typed and
// sent in one click; a blank note falls back to the saved standing note).
// No AI is involved anywhere - this note is the founder's own voice,
// verbatim (anti-swallow invariant).
export default function WeeklyReportForm({
  studentId,
  hasParentEmail,
  reportNote,
  lastReportSentAt,
}: {
  studentId: string;
  hasParentEmail: boolean;
  reportNote: string | null;
  lastReportSentAt: string | null;
}) {
  const [note, setNote] = useState(reportNote ?? '');
  const [savingNote, setSavingNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lastSentLabel = lastReportSentAt
    ? new Date(lastReportSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  async function handleSaveNote() {
    setSavingNote(true);
    setError(null);
    setMessage(null);
    const result = await saveReportNoteAction(studentId, note);
    setSavingNote(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage('Note saved - it will appear on every auto-sent report.');
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setMessage(null);
    const result = await sendWeeklyReportAction(studentId, note);
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
          No parent email set for this student - add one from the student list to send the report.
        </p>
      )}

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
        <button type="button" onClick={handleSaveNote} disabled={savingNote} className={secondaryButtonClass}>
          {savingNote ? 'Saving...' : 'Save as standing note'}
        </button>
      </div>

      <p className="text-xs text-[#9A9080]">
        The report is a branded PDF (practice completed, scores, strongest and weakest area) plus this note.{' '}
        {lastSentLabel ? `Last sent ${lastSentLabel}.` : 'No report sent yet.'}
      </p>

      {message && <p className="text-sm text-[#1A3D2E]">{message}</p>}
      {error && <p className="text-sm text-[#C0392B]">{error}</p>}
    </div>
  );
}