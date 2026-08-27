'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FilePlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, cardClass, accentCardClass } from '@/lib/ui/formStyles';
import { PageHeader } from '@/lib/ui/PageHeader';

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
  generated_from?: string;
}

interface GeneratedGroupSummary {
  groupId: string;
  subject: string;
  topic: string;
  studentCount: number;
}

const MIN_GROUP_SIZE = 2;
const MAX_GROUP_SIZE = 10;

type Phase = 'idle' | 'loading' | 'success' | 'error';
type DifficultyFeedback = 'too_easy' | 'just_right' | 'too_hard';
type DocumentType = 'worksheet' | 'mark_scheme';
type PaperFormat = 'A4' | 'Letter';
type GenerationMode = 'worksheet' | 'quiz';

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

interface TemplateOption {
  id: string;
  name: string;
  notes: string | null;
}

export default function GenerateForm({
  students,
  canDownloadMarkScheme,
  canUseGroupMode,
  canUseDailyMode,
  templates,
}: {
  students: StudentOption[];
  canDownloadMarkScheme: boolean;
  canUseGroupMode: boolean;
  canUseDailyMode: boolean;
  templates: TemplateOption[];
}) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? '');
  const [groupMode, setGroupMode] = useState(false);
  const [dailyMode, setDailyMode] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [selectedGroupStudentIds, setSelectedGroupStudentIds] = useState<string[]>([]);
  const [topicPrompt, setTopicPrompt] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [worksheet, setWorksheet] = useState<GeneratedWorksheetSummary | null>(null);
  const [groupResult, setGroupResult] = useState<GeneratedGroupSummary | null>(null);
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

  function toggleGroupStudent(id: string) {
    setSelectedGroupStudentIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
  }

  const canSubmit = groupMode ? selectedGroupStudentIds.length >= MIN_GROUP_SIZE && trimmedTopic.length > 0 : Boolean(selectedStudentId) && trimmedTopic.length > 0;

  function initials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  async function handleGenerate() {
    if (!canSubmit) return;

    setPhase('loading');
    setErrorMessage(null);
    setLoadingMessageIndex(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const endpoint = groupMode ? '/api/generate/group' : dailyMode ? '/api/generate/daily' : quizMode ? '/api/quiz/generate' : '/api/generate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          groupMode
            ? { studentIds: selectedGroupStudentIds, topicPrompt: trimmedTopic }
            : { studentId: selectedStudentId, topicPrompt: trimmedTopic }
        ),
        signal: controller.signal,
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Worksheet generation failed - please try again.');
        setPhase('error');
        return;
      }

      if (groupMode) {
        setGroupResult(data);
      } else {
        setWorksheet(data.worksheet ?? data.quiz);
        setDifficultyFeedback(null);
      }
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
    setGroupResult(null);
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
      <PageHeader icon={FilePlus} title="New assignment" subtitle="Describe the struggle. Forma builds the practice." />

      {phase !== 'loading' && (
        <div className={`${accentCardClass} flex flex-col gap-4`}>
          {canUseGroupMode && !dailyMode && phase !== 'success' && (
            <label className="flex items-center gap-3 text-sm text-[#5C5849] cursor-pointer w-fit">
              <span className="relative inline-flex h-5 w-9 shrink-0">
                <input
                  type="checkbox"
                  checked={groupMode}
                  onChange={(event) => setGroupMode(event.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-[#E0D9D0] peer-checked:bg-[#1A3D2E] transition-colors duration-micro ease-premium" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-micro ease-premium peer-checked:translate-x-4" />
              </span>
              Group mode - one worksheet for multiple students
            </label>
          )}

          {canUseDailyMode && !groupMode && phase !== 'success' && (
            <label className="flex items-center gap-3 text-sm text-[#5C5849] cursor-pointer w-fit">
              <span className="relative inline-flex h-5 w-9 shrink-0">
                <input
                  type="checkbox"
                  checked={dailyMode}
                  onChange={(event) => {
                    setDailyMode(event.target.checked);
                    if (event.target.checked) setQuizMode(false);
                  }}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-[#E0D9D0] peer-checked:bg-[#1A3D2E] transition-colors duration-micro ease-premium" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-micro ease-premium peer-checked:translate-x-4" />
              </span>
              Daily practice - 5 short questions on one skill
            </label>
          )}

          {!groupMode && !dailyMode && phase !== 'success' && (
            <label className="flex items-center gap-3 text-sm text-[#5C5849] cursor-pointer w-fit">
              <span className="relative inline-flex h-5 w-9 shrink-0">
                <input
                  type="checkbox"
                  checked={quizMode}
                  onChange={(event) => setQuizMode(event.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-[#E0D9D0] peer-checked:bg-[#1A3D2E] transition-colors duration-micro ease-premium" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-micro ease-premium peer-checked:translate-x-4" />
              </span>
              Interactive quiz - student opens on their phone
            </label>
          )}

          {groupMode ? (
            <div>
              <span className={labelClass}>
                Students ({selectedGroupStudentIds.length} selected, {MIN_GROUP_SIZE}-{MAX_GROUP_SIZE})
              </span>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto py-0.5">
                {students.map((student) => {
                  const selected = selectedGroupStudentIds.includes(student.id);
                  const capped = !selected && selectedGroupStudentIds.length >= MAX_GROUP_SIZE;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleGroupStudent(student.id)}
                      disabled={phase === 'success' || capped}
                      className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm transition-all duration-micro ease-premium disabled:opacity-50 disabled:cursor-not-allowed ${
                        selected
                          ? 'bg-[#E8F2ED] border-[#1A3D2E] text-[#1A3D2E] font-medium'
                          : 'bg-white border-[#E0D9D0] text-[#5C5849] hover:border-[#C4B9AC]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-medium flex items-center justify-center ${
                          selected ? 'bg-[#1A3D2E] text-white' : 'bg-[#F0EBE3] text-[#5C5849]'
                        }`}
                      >
                        {initials(student.name)}
                      </span>
                      {student.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <span className={labelClass}>Student</span>
              <div className="flex flex-wrap gap-2">
                {students.map((student) => {
                  const selected = selectedStudentId === student.id;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedStudentId(student.id)}
                      disabled={phase === 'success'}
                      className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm transition-all duration-micro ease-premium disabled:opacity-50 disabled:cursor-not-allowed ${
                        selected
                          ? 'bg-[#E8F2ED] border-[#1A3D2E] text-[#1A3D2E] font-medium'
                          : 'bg-white border-[#E0D9D0] text-[#5C5849] hover:border-[#C4B9AC]'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full text-[10px] font-medium flex items-center justify-center ${
                          selected ? 'bg-[#1A3D2E] text-white' : 'bg-[#F0EBE3] text-[#5C5849]'
                        }`}
                      >
                        {initials(student.name)}
                      </span>
                      {student.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase !== 'success' && (
            <>
              {templates.length > 0 && (
                <div>
                  <label className={labelClass} htmlFor="template">
                    Use a template
                  </label>
                  <select
                    id="template"
                    className={inputClass}
                    value=""
                    onChange={(event) => {
                      const template = templates.find((t) => t.id === event.target.value);
                      if (template?.notes) setTopicPrompt(template.notes);
                    }}
                  >
                    <option value="">Choose a saved template...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
                      className="text-left text-xs text-[#5C5849] bg-[#F0EBE3] border border-[#E0D9D0] rounded-[10px] px-3 py-2 hover:border-[#1A3D2E]"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </details>

              <button type="button" onClick={handleGenerate} disabled={!canSubmit} className={`${primaryButtonClass} self-start`}>
                Create assignment
              </button>
            </>
          )}
        </div>
      )}

      {phase === 'loading' && (
        <div className={`${cardClass} flex flex-col items-center gap-4 py-10`}>
          <p key={loadingMessageIndex} className="text-sm text-[#5C5849] animate-fade-up">
            {LOADING_MESSAGES[loadingMessageIndex]}
          </p>
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
        <div className={`${cardClass} flex flex-col gap-3 animate-fade-up`}>
          <p className="text-sm text-[#C0392B]">{errorMessage}</p>
          <button type="button" onClick={handleGenerate} className={`${primaryButtonClass} self-start`}>
            Try again
          </button>
        </div>
      )}

      {phase === 'success' && groupResult && (
        <div className={`${cardClass} flex flex-col gap-5 animate-fade-up`}>
          <div>
            <p className="text-sm font-medium text-[#1A1A18]">
              {groupResult.subject} - {groupResult.topic}
            </p>
            <p className="text-xs text-[#9A9080] mt-1">Created for {groupResult.studentCount} students.</p>
          </div>
          <Link href={`/dashboard/generate/group/${groupResult.groupId}`} className={`${primaryButtonClass} self-start`}>
            View group results
          </Link>
          <button type="button" onClick={handleReset} className={`${secondaryButtonClass} self-start`}>
            Start another
          </button>
        </div>
      )}

      {phase === 'success' && worksheet && (
        <div className={`${cardClass} flex flex-col gap-5 animate-fade-up`}>
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

          {worksheet.generated_from === 'quiz' ? (
            <div>
              <p className={labelClass}>Quiz link</p>
              <p className="text-sm text-[#5C5849] mb-2">
                Send this link to your student. They can open it on their phone and answer directly.
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/q/${worksheet.digital_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${secondaryButtonClass} inline-flex items-center gap-1.5`}
                >
                  Open quiz
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
                    navigator.clipboard.writeText(`${appUrl}/q/${worksheet.digital_code}`);
                  }}
                  className={`${secondaryButtonClass}`}
                >
                  Copy link
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className={labelClass}>Worksheet</p>
              <div className="flex gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() => handleDownload('A4', 'worksheet')}
                    disabled={downloading['worksheet-A4']}
                    className={secondaryButtonClass}
                  >
                    {downloading['worksheet-A4'] ? 'Preparing...' : 'Download A4'}
                  </button>
                  <p className="text-xs text-muted text-center mt-1">UK style print</p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleDownload('Letter', 'worksheet')}
                    disabled={downloading['worksheet-Letter']}
                    className={secondaryButtonClass}
                  >
                    {downloading['worksheet-Letter'] ? 'Preparing...' : 'Download Letter'}
                  </button>
                  <p className="text-xs text-muted text-center mt-1">America style print</p>
                </div>
              </div>
            </div>
          )}

          {canDownloadMarkScheme && (
            <div>
              <p className={labelClass}>Mark scheme</p>
              <div className="flex gap-2">
                <div>
                  <button
                    type="button"
                    onClick={() => handleDownload('A4', 'mark_scheme')}
                    disabled={downloading['mark_scheme-A4']}
                    className={secondaryButtonClass}
                  >
                    {downloading['mark_scheme-A4'] ? 'Preparing...' : 'Download A4'}
                  </button>
                  <p className="text-xs text-muted text-center mt-1">UK style print</p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleDownload('Letter', 'mark_scheme')}
                    disabled={downloading['mark_scheme-Letter']}
                    className={secondaryButtonClass}
                  >
                    {downloading['mark_scheme-Letter'] ? 'Preparing...' : 'Download Letter'}
                  </button>
                  <p className="text-xs text-muted text-center mt-1">America style print</p>
                </div>
              </div>
            </div>
          )}

          {downloadError && <p className="text-sm text-[#C0392B]">{downloadError}</p>}

          <button type="button" onClick={handleReset} className={`${primaryButtonClass} self-start`}>
            Start another
          </button>
        </div>
      )}
    </div>
  );
}
