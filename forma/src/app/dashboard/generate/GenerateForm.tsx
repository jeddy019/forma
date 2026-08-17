'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, cardClass } from '@/lib/ui/formStyles';

interface StudentOption {
  id: string;
  name: string;
}

interface GeneratedWorksheetSummary {
  id: string;
  digital_code: string;
  subject: string;
  topic: string;
  alignment_note: string | null;
  difficulty: string;
  created_at: string;
}

type Phase = 'idle' | 'loading' | 'success' | 'error';
type DifficultyFeedback = 'too_easy' | 'just_right' | 'too_hard';
type DocumentType = 'worksheet' | 'mark_scheme';
type PaperFormat = 'A4' | 'Letter';

// Design System > LOADING STATE - cycled every 3 seconds while generating.
const LOADING_MESSAGES = [
  'Reading your description...',
  'Building the question set...',
  'Writing the mark scheme...',
  'Adding diagrams...',
  'Almost ready...',
];
const LOADING_MESSAGE_INTERVAL_MS = 3000;

// Performance Rule 6: difficulty buttons disable for 2 seconds after a click.
const DIFFICULTY_DEBOUNCE_MS = 2000;

// User Challenges: no dynamic curriculum topic catalogue exists yet, so the
// collapsible topic picker offers a small set of generic subject-spanning
// starters rather than per-curriculum topics - the AI still receives the
// real student's country/curriculum/subjects server-side regardless of what
// freeform text is typed here, so this is a starting point, not a scope
// limiter.
const TOPIC_STARTERS = [
  'struggles with fractions, particularly adding fractions with different denominators',
  'needs practice with quadratic equations before an upcoming test',
  'finds essay structure difficult when writing about a set text',
  'wants extra practice balancing chemical equations',
  'is confident with the basics but needs a harder challenge on this topic',
];

export default function GenerateForm({
  students,
  canDownloadMarkScheme,
}: {
  students: StudentOption[];
  canDownloadMarkScheme: boolean;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? '');
  const [topicPrompt, setTopicPrompt] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [worksheet, setWorksheet] = useState<GeneratedWorksheetSummary | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [difficultyFeedback, setDifficultyFeedback] = useState<DifficultyFeedback | null>(null);
  const [difficultyLocked, setDifficultyLocked] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (phase !== 'loading') return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((index) => (index + 1) % LOADING_MESSAGES.length);
    }, LOADING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  const trimmedTopic = topicPrompt.trim();
  const showShortHint = trimmedTopic.length > 0 && trimmedTopic.length < 40;
  const showGoodLength = trimmedTopic.length >= 80;

  async function handleGenerate() {
    if (!selectedStudentId || !trimmedTopic) return;

    setPhase('loading');
    setErrorMessage(null);
    setLoadingMessageIndex(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId, topicPrompt: trimmedTopic }),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Worksheet generation failed - please try again.');
        setPhase('error');
        return;
      }

      setWorksheet(data.worksheet);
      setDifficultyFeedback(null);
      setPhase('success');
    } catch {
      // Cancel returns cleanly to the input state - it isn't an error.
      if (controller.signal.aborted) {
        setPhase('idle');
        return;
      }
      setErrorMessage('Worksheet generation failed - please try again.');
      setPhase('error');
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleReset() {
    setPhase('idle');
    setWorksheet(null);
    setTopicPrompt('');
    setDifficultyFeedback(null);
    setDownloadError(null);
  }

  async function handleDifficultyFeedback(value: DifficultyFeedback) {
    if (!worksheet || difficultyLocked) return;
    setDifficultyLocked(true);
    setDifficultyFeedback(value);

    const supabase = createClient();
    await supabase.from('worksheets').update({ difficulty_feedback: value }).eq('id', worksheet.id);

    setTimeout(() => setDifficultyLocked(false), DIFFICULTY_DEBOUNCE_MS);
  }

  async function handleDownload(format: PaperFormat, docType: DocumentType) {
    if (!worksheet) return;
    const key = `${docType}-${format}`;
    setDownloading((prev) => ({ ...prev, [key]: true }));
    setDownloadError(null);

    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worksheetId: worksheet.id, format, document: docType }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: undefined }));
        setDownloadError(data.error ?? 'Could not generate the PDF - please try again.');
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? 'worksheet.pdf';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Could not generate the PDF - please try again.');
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Generate a worksheet</h1>
        <p className="text-sm text-[#5C5849]">Describe the struggle. Forma builds the practice.</p>
      </div>

      {phase !== 'loading' && (
        <div className={`${cardClass} flex flex-col gap-4`}>
          <div>
            <label className={labelClass} htmlFor="student">
              Student
            </label>
            <select
              id="student"
              className={inputClass}
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              disabled={phase === 'success'}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>

          {phase !== 'success' && (
            <>
              <div>
                <label className={labelClass} htmlFor="topic">
                  What do they need to practice?
                </label>
                <textarea
                  id="topic"
                  rows={3}
                  maxLength={1000}
                  className={inputClass}
                  placeholder="e.g. Naeto is in Year 9 and struggles with fractions, particularly adding fractions with different denominators."
                  value={topicPrompt}
                  onChange={(event) => setTopicPrompt(event.target.value)}
                />
                <div className="flex items-center justify-between mt-1 min-h-[16px]">
                  {showShortHint && (
                    <p className="text-xs text-[#9A9080]">Add the student&apos;s year group for better results.</p>
                  )}
                  {showGoodLength && <p className="text-xs text-[#1A3D2E]">&#10003; Good detail</p>}
                </div>
              </div>

              <details className="text-sm">
                <summary className="cursor-pointer text-[#1A3D2E] font-medium">Need an example?</summary>
                <div className="flex flex-col gap-1.5 mt-2">
                  {TOPIC_STARTERS.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => setTopicPrompt(starter.charAt(0).toUpperCase() + starter.slice(1))}
                      className="text-left text-xs text-[#5C5849] bg-white border border-[#E0D9D0] rounded-[10px] px-3 py-2 hover:border-[#1A3D2E]"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </details>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!selectedStudentId || !trimmedTopic}
                className={`${primaryButtonClass} self-start`}
              >
                Generate worksheet
              </button>
            </>
          )}
        </div>
      )}

      {phase === 'loading' && (
        <div className={`${cardClass} flex flex-col items-center gap-4 py-10`}>
          <p className="text-sm text-[#5C5849]">{LOADING_MESSAGES[loadingMessageIndex]}</p>
          <div className="relative h-1 w-full max-w-xs overflow-hidden rounded-full bg-[#E0D9D0]">
            <div
              className="absolute inset-y-0 w-1/3 rounded-full bg-[#C8A84B]"
              style={{ animation: 'forma-progress-slide 1.4s ease-in-out infinite' }}
            />
          </div>
          <button type="button" onClick={handleCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className={`${cardClass} flex flex-col gap-3`}>
          <p className="text-sm text-[#C0392B]">{errorMessage}</p>
          <button type="button" onClick={handleGenerate} className={`${primaryButtonClass} self-start`}>
            Try again
          </button>
        </div>
      )}

      {phase === 'success' && worksheet && (
        <div className={`${cardClass} flex flex-col gap-5`}>
          <div>
            <p className="text-sm font-medium text-[#1A1A18]">
              {worksheet.subject} - {worksheet.topic}
            </p>
            {worksheet.alignment_note && (
              <p className="text-xs italic text-[#9A9080] mt-1">{worksheet.alignment_note}</p>
            )}
          </div>

          <div>
            <p className={labelClass}>How was the difficulty?</p>
            <div className="flex gap-2">
              {(
                [
                  { value: 'too_easy', label: 'Too easy' },
                  { value: 'just_right', label: 'Just right' },
                  { value: 'too_hard', label: 'Too hard' },
                ] as { value: DifficultyFeedback; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={difficultyLocked}
                  onClick={() => handleDifficultyFeedback(option.value)}
                  className={
                    difficultyFeedback === option.value
                      ? `${primaryButtonClass} !px-4 !py-2 text-xs`
                      : `${secondaryButtonClass} !px-4 !py-2 text-xs`
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className={labelClass}>Worksheet</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDownload('A4', 'worksheet')}
                disabled={downloading['worksheet-A4']}
                className={secondaryButtonClass}
              >
                {downloading['worksheet-A4'] ? 'Preparing...' : 'Download A4'}
              </button>
              <button
                type="button"
                onClick={() => handleDownload('Letter', 'worksheet')}
                disabled={downloading['worksheet-Letter']}
                className={secondaryButtonClass}
              >
                {downloading['worksheet-Letter'] ? 'Preparing...' : 'Download Letter'}
              </button>
            </div>
          </div>

          {canDownloadMarkScheme && (
            <div>
              <p className={labelClass}>Mark scheme</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload('A4', 'mark_scheme')}
                  disabled={downloading['mark_scheme-A4']}
                  className={secondaryButtonClass}
                >
                  {downloading['mark_scheme-A4'] ? 'Preparing...' : 'Download A4'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('Letter', 'mark_scheme')}
                  disabled={downloading['mark_scheme-Letter']}
                  className={secondaryButtonClass}
                >
                  {downloading['mark_scheme-Letter'] ? 'Preparing...' : 'Download Letter'}
                </button>
              </div>
            </div>
          )}

          {downloadError && <p className="text-sm text-[#C0392B]">{downloadError}</p>}

          <button type="button" onClick={handleReset} className={`${primaryButtonClass} self-start`}>
            Generate another
          </button>
        </div>
      )}
    </div>
  );
}
