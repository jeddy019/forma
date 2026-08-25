'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeft, Check, ChevronDown, Minus, Plus } from 'lucide-react';
import { saveMarkingAction, type SaveMarkingResult } from '../actions';

// R4 quick-marking: one decision per answered extended part, thumb-sized
// controls, nothing else on screen. The tutor's 30-second path is scroll,
// glance at each AI suggestion (pre-selected as the default), adjust with
// the stepper only where they disagree, Save.

export interface DecisionItem {
  key: string;
  questionId: string;
  partIndex: number;
  partLabel: string | null;
  questionNumber: number;
  marks: number;
  questionHtml: string;
  studentAnswer: string;
  aiSuggestion: { marks_awarded: number; reasoning: string; confidence: 'low' | 'medium' | 'high' } | null;
  existingTutorMark: number | null;
  scheme: { M1: string; A1: string; allow: string; commonError: string } | null;
  correctAnswer: string | null;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-[#E8F2ED] text-[#1A3D2E]',
  medium: 'bg-[#FEF9EC] text-[#B8963C]',
  low: 'bg-[#FDEDEC] text-[#C0392B]',
};

const initialState: SaveMarkingResult = {};

export default function QuickMarkForm({
  submissionId,
  studentName,
  subject,
  topic,
  reviewed,
  existingFeedback,
  items,
  tier1Summary,
  tier1Awarded,
  totalMarksAll,
}: {
  submissionId: string;
  studentName: string;
  subject: string;
  topic: string;
  reviewed: boolean;
  existingFeedback: string | null;
  items: DecisionItem[];
  tier1Summary: { correct: number; total: number };
  tier1Awarded: number;
  totalMarksAll: number;
}) {
  const [state, formAction, pending] = useActionState(saveMarkingAction, initialState);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      items.map((item) => [
        item.key,
        item.existingTutorMark ?? item.aiSuggestion?.marks_awarded ?? 0,
      ])
    )
  );
  const [schemeOpen, setSchemeOpen] = useState<Record<string, boolean>>({});
  const [feedbackOpen, setFeedbackOpen] = useState(existingFeedback !== null && existingFeedback !== '');
  const router = useRouter();

  // Straight back to the queue on a clean save - the whole point of the
  // quick flow. When adaptive difficulty moved, though, stay put so the
  // tutor actually sees why (the notice is the feature, not noise).
  useEffect(() => {
    if (state.success && !state.difficultyNotice) {
      router.push('/dashboard/marking');
    }
  }, [state, router]);

  const showNotice = state.success === true && state.difficultyNotice !== undefined;

  const awardedSoFar =
    tier1Awarded + Object.entries(values).reduce((sum, [, v]) => sum + v, 0);
  const livePercent = totalMarksAll > 0 ? Math.round((awardedSoFar / totalMarksAll) * 100) : null;

  function step(item: DecisionItem, delta: number) {
    setValues((prev) => ({
      ...prev,
      [item.key]: Math.max(0, Math.min(item.marks, (prev[item.key] ?? 0) + delta)),
    }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 pb-28 max-w-xl">
      <input type="hidden" name="submissionId" value={submissionId} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#1A1A18] mb-0.5">
            {studentName} - {subject}
          </h1>
          <p className="text-xs text-[#5C5849]">{topic}</p>
        </div>
        <Link
          href={`/dashboard/marking/${submissionId}`}
          className="flex items-center gap-1 text-xs font-medium text-[#1A3D2E] shrink-0 mt-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          Full review
        </Link>
      </div>

      {tier1Summary.total > 0 && (
        <p className="text-xs text-[#5C5849] px-1">
          Auto-marked questions: <span className="font-medium text-[#1A3D2E]">{tier1Summary.correct}/{tier1Summary.total} correct</span>
          {reviewed && ' - previously reviewed'}
        </p>
      )}

      {items.length === 0 ? (
        <div className="bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-6 shadow-card text-center">
          <p className="text-sm text-[#1A1A18] mb-1">Nothing needs your judgement.</p>
          <p className="text-xs text-[#5C5849] mb-4">Every answered question was auto-marked.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[#5C5849] px-1">
            {items.length} answer{items.length === 1 ? '' : 's'} to review - the AI&apos;s suggestion is pre-filled.
          </p>
          {items.map((item) => {
            const current = values[item.key] ?? 0;
            const suggested = item.aiSuggestion?.marks_awarded ?? null;
            return (
              <div key={item.key} className="bg-[#F0EBE3] border border-[#E0D9D0] rounded-[12px] p-5 shadow-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#1A3D2E]">
                    Q{item.questionNumber}
                    {item.partLabel ? `(${item.partLabel})` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {suggested !== null && (
                      <span className={`text-[9px] uppercase tracking-wide rounded-full px-2 py-0.5 ${CONFIDENCE_STYLES[item.aiSuggestion!.confidence]}`}>
                        AI {suggested}/{item.marks}
                      </span>
                    )}
                    <span className="text-xs text-[#9A9080]">[{item.marks}]</span>
                  </div>
                </div>

                <div
                  className="rich-text text-sm text-[#5C5849] leading-relaxed mb-3 [&_.code-block]:text-xs"
                  dangerouslySetInnerHTML={{ __html: item.questionHtml }}
                />

                <div className="bg-white border border-[#E0D9D0] rounded-[10px] px-4 py-3 text-sm text-[#1A1A18] whitespace-pre-wrap break-words mb-3">
                  {item.studentAnswer}
                </div>

                {item.aiSuggestion && (
                  <p className="text-xs text-[#5C5849] italic mb-3">{item.aiSuggestion.reasoning}</p>
                )}

                {/* Mark scheme is one tap away, not always-on-screen - most
                    parts need at most a glance at the AI reasoning above. */}
                {item.scheme && (
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => setSchemeOpen((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className="flex items-center gap-1 text-xs font-medium text-[#1A3D2E]"
                      aria-expanded={schemeOpen[item.key] ?? false}
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-micro ease-premium ${schemeOpen[item.key] ? 'rotate-180' : ''}`}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      Mark scheme
                    </button>
                    {schemeOpen[item.key] && (
                      <div className="bg-[#E8F2ED] rounded-[10px] p-3 mt-2 flex flex-col gap-1.5 animate-fade-up">
                        {(['M1', 'A1'] as const).map((tag) => (
                          <p key={tag} className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">{tag}:</span> {item.scheme![tag]}
                          </p>
                        ))}
                        {item.correctAnswer && (
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">Answer:</span> {item.correctAnswer}
                          </p>
                        )}
                        {item.scheme.allow && (
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">Allow:</span> {item.scheme.allow}
                          </p>
                        )}
                        {item.scheme.commonError && (
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">Common error:</span> {item.scheme.commonError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Thumb-sized stepper, not a number input - the whole flow
                    is usable one-handed without zooming. */}
                <input type="hidden" name={`mark:${item.questionId}:${item.partIndex}`} value={current} />
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease marks for Q${item.questionNumber}${item.partLabel ? ` (${item.partLabel})` : ''}`}
                      disabled={pending || current === 0}
                      onClick={() => step(item, -1)}
                      className="w-11 h-11 flex items-center justify-center rounded-[10px] bg-white border border-[#E0D9D0] text-[#1A3D2E] hover:border-[#C4B9AC] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                    </button>
                    <span className="w-14 text-center text-lg font-semibold text-[#1A1A18]" aria-live="polite">
                      {current}
                      <span className="text-sm text-[#9A9080] font-normal">/{item.marks}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase marks for Q${item.questionNumber}${item.partLabel ? ` (${item.partLabel})` : ''}`}
                      disabled={pending || current >= item.marks}
                      onClick={() => step(item, 1)}
                      className="w-11 h-11 flex items-center justify-center rounded-[10px] bg-white border border-[#E0D9D0] text-[#1A3D2E] hover:border-[#C4B9AC] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                  {suggested !== null && current !== suggested && (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setValues((prev) => ({ ...prev, [item.key]: suggested }))}
                      className="flex items-center gap-1 text-xs font-medium text-[#1A3D2E]"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
                      Use AI&apos;s {suggested}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Stays mounted while hidden so typed feedback survives collapsing. */}
      <div className={feedbackOpen ? '' : 'hidden'}>
        <label className="text-xs font-medium text-[#1A3D2E] block mb-1.5" htmlFor="quick-feedback">
          Feedback for the student (optional)
        </label>
        <textarea
          id="quick-feedback"
          name="feedback"
          rows={3}
          maxLength={2000}
          defaultValue={existingFeedback ?? ''}
          className="w-full px-4 py-3 rounded-[10px] text-sm bg-white border border-[#E0D9D0] text-[#1A1A18] outline-none focus:border-[#1A3D2E] focus:shadow-[0_0_0_3px_rgba(26,61,46,0.12)] transition-colors duration-micro ease-premium"
          placeholder="e.g. Great working on Q7 - watch the sign in step 2."
        />
      </div>
      {!feedbackOpen && (
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="self-start text-xs font-medium text-[#1A3D2E] px-1"
        >
          Add feedback
        </button>
      )}

      {state.error && <p className="text-sm text-[#C0392B] px-1">{state.error}</p>}

      {showNotice && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E0D9D0] px-4 py-4 sm:px-6 animate-fade-up z-10">
          <div className="max-w-xl mx-auto">
            <p className="text-sm text-[#C8A84B] mb-3">{state.difficultyNotice}</p>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/marking" className="px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white active:scale-[0.98] transition-all duration-micro ease-premium">
                Done
              </Link>
              <Link href={`/dashboard/marking/${submissionId}`} className="text-sm font-medium text-[#1A3D2E]">
                Open full review
              </Link>
            </div>
          </div>
        </div>
      )}

      {!showNotice && (
        /* Sticky bottom bar with the live score - the tutor sees the final
           percentage move as they step marks, before committing. */
        <div className="fixed bottom-0 left-0 right-0 bg-[#F7F4EF]/95 backdrop-blur-sm border-t border-[#E0D9D0] px-4 py-3 sm:px-6">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm text-[#5C5849]">
              Score:{' '}
              <span className="font-semibold text-[#1A1A18]">
                {livePercent !== null ? `${livePercent}%` : `${awardedSoFar}/${totalMarksAll}`}
              </span>
            </span>
            <button
              type="submit"
              disabled={pending}
              className="px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white hover:bg-[#152F23] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {pending ? 'Saving...' : reviewed ? 'Update marking' : 'Save marking'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
