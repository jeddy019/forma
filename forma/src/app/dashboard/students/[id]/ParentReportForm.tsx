'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { generateParentReportAction, sendParentReportAction } from './actions';
import { inputClass, primaryButtonClass, secondaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

// Server actions are called directly as async functions from event
// handlers here (not via useActionState) - same pattern SettingsPanel.tsx
// already uses for handleUpgrade/handleCancel, chosen because this flow
// has a middle step (edit the draft) that useActionState's single
// submit-then-result cycle doesn't naturally fit.
export default function ParentReportForm({ studentId, hasParentEmail }: { studentId: string; hasParentEmail: boolean }) {
  const [paragraphs, setParagraphs] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSent(false);
    const result = await generateParentReportAction(studentId);
    setGenerating(false);
    if (result.error || !result.paragraphs) {
      setError(result.error ?? 'Could not generate a draft.');
      return;
    }
    setParagraphs(result.paragraphs);
  }

  async function handleSend() {
    if (!paragraphs) return;
    setSending(true);
    setError(null);
    const result = await sendParentReportAction(studentId, paragraphs);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
    setParagraphs(null);
  }

  function updateParagraph(index: number, value: string) {
    if (!paragraphs) return;
    setParagraphs(paragraphs.map((p, i) => (i === index ? value : p)));
  }

  return (
    <div className={`${accentCardClass} flex flex-col gap-3`}>
      <FormHeader icon={Mail} title="Parent report" />

      {!hasParentEmail && (
        <p className="text-sm text-[#9A9080] italic">
          This student is not in a family with an email - add one from the Families page first.
        </p>
      )}

      {sent && <p className="text-sm text-[#1A3D2E]">Report sent.</p>}

      {!paragraphs ? (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !hasParentEmail}
          className={`${primaryButtonClass} self-start`}
        >
          {generating ? 'Drafting...' : 'Generate draft'}
        </button>
      ) : (
        <>
          <p className="text-sm text-[#5C5849]">Review and edit before sending - nothing is sent until you approve it.</p>
          <div className="flex flex-col gap-3">
            {paragraphs.map((paragraph, i) => (
              <textarea
                key={i}
                value={paragraph}
                onChange={(event) => updateParagraph(i, event.target.value)}
                rows={3}
                maxLength={2000}
                className={inputClass}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={handleSend} disabled={sending} className={primaryButtonClass}>
              {sending ? 'Sending...' : 'Send to parent'}
            </button>
            <button type="button" onClick={() => setParagraphs(null)} disabled={sending} className={secondaryButtonClass}>
              Discard
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-[#C0392B]">{error}</p>}
    </div>
  );
}
