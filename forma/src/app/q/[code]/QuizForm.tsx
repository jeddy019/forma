'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import 'katex/dist/katex.min.css';
import { renderDiagramSvg } from '@/lib/diagrams/renderDiagramSpec';
import type { QuizQuestion } from './page';

type Phase = 'idle' | 'submitting' | 'success' | 'error';
type CheckStatus = 'correct' | 'incorrect' | 'manual';

interface PartCheck {
  value: string;
  status: CheckStatus;
}

const inputClass =
  'w-full px-4 py-[14px] rounded-[10px] text-sm bg-white border text-[#1A1A18] placeholder:text-[#9A9080] placeholder:italic outline-none focus:shadow-[0_0_0_3px_rgba(26,61,46,0.12)] transition-all duration-micro ease-premium';

function inputBorderClass(status?: CheckStatus): string {
  if (status === 'correct') return 'border-[#1A3D2E] bg-[#E8F2ED]/40 focus:border-[#1A3D2E]';
  if (status === 'incorrect') return 'border-[#C0392B] bg-[#FDEDEC]/50 focus:border-[#C0392B]';
  return 'border-[#E0D9D0] bg-white focus:border-[#1A3D2E] hover:border-[#C4B9AC]';
}

const primaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white hover:bg-[#152F23] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';

const secondaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium border border-[#1A3D2E] text-[#1A3D2E] hover:bg-[#E8F2ED]/40 active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';

const cardClass = 'bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card';

const CHECK_DEBOUNCE_MS = 700;

export default function QuizForm({
  digitalCode,
  questions,
}: {
  digitalCode: string;
  questions: QuizQuestion[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [checks, setChecks] = useState<Record<string, PartCheck>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const currentQuestion = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;

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
      if (answersRef.current[questionId]?.[partIndex] === value) {
        setChecks((prev) => ({ ...prev, [key]: { value, status: data.status as CheckStatus } }));
      }
    } catch {
      // Instant feedback is best-effort
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

  function isQuestionAnswered(question: QuizQuestion): boolean {
    const questionAnswers = answers[question.id] ?? [];
    return question.parts.every((_, partIndex) => (questionAnswers[partIndex] ?? '').trim().length > 0);
  }

  const answeredCount = useMemo(
    () => questions.filter(isQuestionAnswered).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers, questions]
  );
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const goToNext = useCallback(() => {
    if (!isLast) {
      flushCheck(currentQuestion.id, 0);
      setCurrentIndex((i) => i + 1);
    }
  }, [isLast, currentQuestion]);

  const goToPrev = useCallback(() => {
    if (!isFirst) {
      setCurrentIndex((i) => i - 1);
    }
  }, [isFirst]);

  // Swipe support
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only horizontal swipes (dx > 50px and |dx| > |dy|)
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && !isLast) goToNext();
      if (dx > 0 && !isFirst) goToPrev();
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (phase === 'submitting' || phase === 'success') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNext();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrev();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, phase]);

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
          Quiz submitted
        </h2>
        <p className="text-sm text-[#5C5849]">
          You got {answeredCount} of {questions.length} questions answered.
        </p>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const totalMarks = currentQuestion.parts.reduce((sum, part) => sum + part.marks, 0);
  const questionAnswered = isQuestionAnswered(currentQuestion);
  const typeLabel = currentQuestion.type === 'warm-up' ? 'Warm-up' : currentQuestion.type === 'challenge' ? 'Challenge' : null;
  const typeColor = currentQuestion.type === 'warm-up' ? 'text-[#C8A84B]' : currentQuestion.type === 'challenge' ? 'text-[#1A3D2E]' : 'text-[#9A9080]';

  return (
    <div
      className="flex flex-col gap-4 pb-28"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-[#5C5849] px-1">
        <span>
          {currentIndex + 1} of {questions.length}
        </span>
        <span>{progressPercent}%</span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-[#E0D9D0] -mt-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#C8A84B] transition-[width] duration-standard ease-premium"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Question dots */}
      <div className="flex items-center justify-center gap-1.5 py-2">
        {questions.map((q, i) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setCurrentIndex(i)}
            className={`w-2 h-2 rounded-full transition-all duration-micro ease-premium ${
              i === currentIndex
                ? 'bg-[#1A3D2E] scale-125'
                : isQuestionAnswered(q)
                  ? 'bg-[#1A3D2E]/40'
                  : 'bg-[#E0D9D0]'
            }`}
            aria-label={`Go to question ${i + 1}`}
          />
        ))}
      </div>

      {/* Current question card */}
      <div className={`${cardClass} animate-fade-up`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#1A3D2E]">Q{currentIndex + 1}</span>
            {typeLabel && (
              <span className={`text-[9px] uppercase tracking-wider ${typeColor}`}>
                {typeLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {questionAnswered && <CheckCircle2 className="w-3.5 h-3.5 text-[#1A3D2E]" strokeWidth={2} aria-hidden="true" />}
            <span className="text-xs text-[#9A9080]">[{totalMarks}]</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {currentQuestion.parts.map((part, partIndex) => {
            const key = partKey(currentQuestion.id, partIndex);
            const check = checks[key];
            const showFeedback =
              check !== undefined && check.value === (answers[currentQuestion.id]?.[partIndex] ?? '');
            const isMultiPart = currentQuestion.parts.length > 1;

            return (
              <div key={partIndex} className={isMultiPart ? 'pl-4' : ''}>
                <div className="flex items-start justify-between gap-3 mb-2">
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
                <div className="pt-2 mt-1 border-t border-[#E0D9D0]">
                  <input
                    type="text"
                    className={`${inputClass} ${inputBorderClass(showFeedback ? check.status : undefined)}`}
                    placeholder="Type your answer"
                    value={answers[currentQuestion.id]?.[partIndex] ?? ''}
                    onChange={(event) => setAnswer(currentQuestion.id, partIndex, event.target.value)}
                    onBlur={() => flushCheck(currentQuestion.id, partIndex)}
                    disabled={phase === 'submitting'}
                    aria-describedby={showFeedback ? `${key}-feedback` : undefined}
                  />
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
                        Not quite
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

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goToPrev}
          disabled={isFirst}
          className={`${secondaryButtonClass} flex items-center gap-1.5`}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        {!isLast ? (
          <button
            type="button"
            onClick={goToNext}
            className={`${primaryButtonClass} flex items-center gap-1.5`}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={phase === 'submitting'}
            className={`${primaryButtonClass}`}
          >
            {phase === 'submitting' ? 'Submitting...' : 'Submit quiz'}
          </button>
        )}
      </div>

      {phase === 'error' && errorMessage && (
        <p className="text-sm text-[#C0392B] animate-fade-up">{errorMessage}</p>
      )}

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F7F4EF]/95 backdrop-blur-sm border-t border-[#E0D9D0] px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <span className="text-xs text-[#9A9080]">
            {answeredCount === questions.length
              ? 'All questions answered.'
              : `${questions.length - answeredCount} left`}
          </span>
          {isLast && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={phase === 'submitting'}
              className={`${primaryButtonClass} w-full sm:w-auto`}
            >
              {phase === 'submitting' ? 'Submitting...' : 'Submit quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
