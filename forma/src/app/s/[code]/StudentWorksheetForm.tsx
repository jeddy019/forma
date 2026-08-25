'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { renderDiagramSvg } from '@/lib/diagrams/renderDiagramSpec';
import { sectionDividerLabel } from '@/lib/worksheet/sectionDividerLabel';
import type { StudentQuestion } from './page';

type Phase = 'idle' | 'submitting' | 'success' | 'error';
type CheckStatus = 'correct' | 'incorrect' | 'manual';

interface PartCheck {
  value: string;
  status: CheckStatus;
}

// Kept local rather than importing from lib/ui/formStyles.ts - that file's
// tokens are dashboard-only by convention (this route is the one place in
// the app with zero auth, see the page-level comment on why). Brought onto
// the same Design System v2 motion scale (duration-micro/ease-premium) as
// everywhere else, rather than the old standalone duration-200 this file
// used to hardcode.
const inputClass =
  'w-full px-4 py-[14px] rounded-[10px] text-sm bg-white border text-[#1A1A18] placeholder:text-[#9A9080] placeholder:italic outline-none focus:shadow-[0_0_0_3px_rgba(26,61,46,0.12)] transition-all duration-micro ease-premium';

function inputBorderClass(status?: CheckStatus): string {
  if (status === 'correct') return 'border-[#1A3D2E] bg-[#E8F2ED]/40 focus:border-[#1A3D2E]';
  if (status === 'incorrect') return 'border-[#C0392B] bg-[#FDEDEC]/50 focus:border-[#C0392B]';
  return 'border-[#E0D9D0] bg-white focus:border-[#1A3D2E] hover:border-[#C4B9AC]';
}

const primaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white hover:bg-[#152F23] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';

// Same drift as page.tsx's local cardClass - shadow-card was already the
// right token, but the border was still the pre-Phase-8 0.5px value, which
// renders as invisible on plenty of displays (the exact bug the app-wide
// fix addressed everywhere else). Bumped to a full 1px to match.
const cardClass = 'bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card';

const CHECK_DEBOUNCE_MS = 700;

export default function StudentWorksheetForm({
  digitalCode,
  questions,
}: {
  digitalCode: string;
  questions: StudentQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [checks, setChecks] = useState<Record<string, PartCheck>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Latest answers for stale-response guarding inside async check callbacks.
  // Synced in an effect (not during render - react-hooks/refs), which is
  // sufficient: every reader of this ref runs after commit.
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  function partKey(questionId: string, partIndex: number): string {
    return `${questionId}:${partIndex}`;
  }

  async function fireCheck(key: string, questionId: string, partIndex: number, value: string) {
    try {
      const res = await fetch('/api/check-part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digitalCode, questionId, partIndex, answer: value }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { status?: CheckStatus | 'cleared' };
      if (!data.status || data.status === 'cleared') return;
      // Stale guard: only apply if the student hasn't kept typing past the
      // value this verdict belongs to.
      if (answersRef.current[questionId]?.[partIndex] === value) {
        setChecks((prev) => ({ ...prev, [key]: { value, status: data.status as CheckStatus } }));
      }
    } catch {
      // Instant feedback is best-effort - never blocks typing or submission.
    }
  }

  function scheduleCheck(questionId: string, partIndex: number, value: string) {
    const key = partKey(questionId, partIndex);
    const existing = timersRef.current.get(key);
    if (existing) clearTimeout(existing);
    if (value.trim() === '') {
      setChecks((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    if (checks[key]?.value === value) return;
    timersRef.current.set(
      key,
      setTimeout(() => {
        timersRef.current.delete(key);
        fireCheck(key, questionId, partIndex, value);
      }, CHECK_DEBOUNCE_MS)
    );
  }

  function flushCheck(questionId: string, partIndex: number) {
    const key = partKey(questionId, partIndex);
    const timer = timersRef.current.get(key);
    const value = answersRef.current[questionId]?.[partIndex] ?? '';
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(key);
    }
    if (value.trim() !== '' && checks[key]?.value !== value) {
      fireCheck(key, questionId, partIndex, value);
    }
  }

  function setAnswer(questionId: string, partIndex: number, value: string) {
    setAnswers((prev) => {
      const next = [...(prev[questionId] ?? [])];
      next[partIndex] = value;
      return { ...prev, [questionId]: next };
    });
    scheduleCheck(questionId, partIndex, value);
  }

  function isQuestionAnswered(question: StudentQuestion): boolean {
    const questionAnswers = answers[question.id] ?? [];
    return question.parts.every((_, partIndex) => (questionAnswers[partIndex] ?? '').trim().length > 0);
  }

  const answeredCount = useMemo(
    () => questions.filter(isQuestionAnswered).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isQuestionAnswered closes over `answers`, the real dependency
    [answers, questions]
  );
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  async function handleSubmit() {
    setPhase('submitting');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digitalCode, answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? 'Could not submit your answers - please try again.');
        setPhase('error');
        return;
      }
      setPhase('success');
    } catch {
      setErrorMessage('Connection lost. Your progress is saved.');
      setPhase('error');
    }
  }

  if (phase === 'success') {
    return (
      <div className={`${cardClass} text-center animate-fade-up`}>
        <CheckCircle2 className="w-8 h-8 text-[#1A3D2E] mx-auto mb-3" strokeWidth={1.5} aria-hidden="true" />
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-1" style={{ fontFamily: 'var(--font-fira)' }}>
          Answers submitted
        </h2>
        <p className="text-sm text-[#5C5849]">Your tutor will review your work soon.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Progress - a determinate bar (unlike the generation loading state's
          indeterminate slide) since answered-question count is always known
          here, giving the student a concrete sense of how much is left. */}
      <div className="flex items-center justify-between text-xs text-[#5C5849] px-1">
        <span>
          {answeredCount} of {questions.length} answered
        </span>
        <span>{progressPercent}%</span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#E0D9D0] -mt-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#C8A84B] transition-[width] duration-standard ease-premium"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {questions.map((question, index) => {
        const divider = sectionDividerLabel(question, index, questions);
        const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
        const isMultiPart = question.parts.length > 1;
        const answered = isQuestionAnswered(question);

        return (
          <div key={question.id}>
            {divider && (
              <p
                className={`text-[9px] uppercase tracking-widest mb-3 mt-4 pb-1.5 border-b border-[#E0D9D0] ${
                  divider === 'Warm-up' ? 'text-[#C8A84B]' : 'text-[#1A3D2E]'
                }`}
              >
                {divider}
              </p>
            )}
            <div
              className={`${cardClass} transition-colors duration-standard ease-premium ${
                answered ? 'border-[#1A3D2E]/30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[#1A3D2E]">Q{index + 1}</span>
                <div className="flex items-center gap-2">
                  {answered && <CheckCircle2 className="w-3.5 h-3.5 text-[#1A3D2E]" strokeWidth={2} aria-hidden="true" />}
                  <span className="text-xs text-[#9A9080]">[{totalMarks}]</span>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {question.parts.map((part, partIndex) => {
                  const key = partKey(question.id, partIndex);
                  const check = checks[key];
                  const showFeedback =
                    check !== undefined && check.value === (answers[question.id]?.[partIndex] ?? '');
                  return (
                    <div key={partIndex} className={isMultiPart ? 'pl-4' : ''}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        {/* textHtml arrives pre-rendered from the server through
                            the same renderRichText pipeline as the PDF (KaTeX
                            math, code fences, escaped prose) - see page.tsx. */}
                        <div className="rich-text text-sm text-[#1A1A18] leading-relaxed flex-1">
                          {part.part_label && <span className="font-medium">({part.part_label}) </span>}
                          <span dangerouslySetInnerHTML={{ __html: part.textHtml }} />
                        </div>
                        <span className="text-xs text-[#9A9080] whitespace-nowrap">[{part.marks}]</span>
                      </div>
                      {part.diagram_spec && (
                        <div
                          className="my-3 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                          dangerouslySetInnerHTML={{ __html: renderDiagramSvg(part.diagram_spec) }}
                        />
                      )}
                      {/* A hairline above the answer input - the same "question
                          ends, answer space begins" separator as the PDF
                          template, so the digital and printed versions read as
                          the same product rather than two different ones. */}
                      <div className="pt-2 mt-1 border-t border-[#E0D9D0]">
                        <textarea
                          rows={2}
                          maxLength={2000}
                          className={`${inputClass} ${inputBorderClass(showFeedback ? check.status : undefined)}`}
                          placeholder="Type your answer"
                          value={answers[question.id]?.[partIndex] ?? ''}
                          onChange={(event) => setAnswer(question.id, partIndex, event.target.value)}
                          onBlur={() => flushCheck(question.id, partIndex)}
                          disabled={phase === 'submitting'}
                          aria-describedby={showFeedback ? `${key}-feedback` : undefined}
                        />
                        {/* Instant Tier 1 feedback - server-judged via
                            /api/check-part, so the correct answer never
                            reaches the browser. "extended" parts get no
                            verdict here (Tier 2/3 territory at submission). */}
                        <div aria-live="polite">
                          {showFeedback && check.status === 'correct' && (
                            <p id={`${key}-feedback`} className="flex items-center gap-1.5 mt-1.5 text-xs text-[#1A3D2E] animate-fade-up">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                              Correct
                            </p>
                          )}
                          {showFeedback && check.status === 'incorrect' && (
                            <p id={`${key}-feedback`} className="flex items-center gap-1.5 mt-1.5 text-xs text-[#C0392B] animate-fade-up">
                              <XCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                              Not quite - check it again before submitting.
                            </p>
                          )}
                          {showFeedback && check.status === 'manual' && (
                            <p id={`${key}-feedback`} className="mt-1.5 text-xs italic text-[#9A9080] animate-fade-up">
                              Your tutor will review this answer.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {phase === 'error' && errorMessage && <p className="text-sm text-[#C0392B] animate-fade-up">{errorMessage}</p>}

      {/* Sticky bottom submit bar - the question list can run past a full
          mobile viewport (most students open this on a phone), so the
          submit action stays reachable without scrolling back down. */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F7F4EF]/95 backdrop-blur-sm border-t border-[#E0D9D0] px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <span className="text-xs text-[#9A9080] hidden sm:inline">
            {answeredCount === questions.length ? 'All questions answered.' : `${questions.length - answeredCount} left to answer.`}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
            className={`${primaryButtonClass} w-full sm:w-auto`}
          >
            {phase === 'submitting' ? 'Submitting...' : 'Submit answers'}
          </button>
        </div>
      </div>
    </div>
  );
}
