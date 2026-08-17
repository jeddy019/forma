'use client';

import { useActionState } from 'react';
import { saveMarkingAction, type SaveMarkingResult } from './actions';
import { sectionDividerLabel } from '@/lib/worksheet/sectionDividerLabel';
import { cardClass, inputClass, labelClass, primaryButtonClass } from '@/lib/ui/formStyles';

export interface MergedPart {
  partLabel: string | null;
  text: string;
  marks: number;
  studentAnswer: string;
  answered: boolean;
  isExtended: boolean;
  correctAnswer: string | null;
  markScheme: { M1: string; A1: string; allow: string; commonError: string } | null;
  tier1: { matched: boolean; marksAwarded: number } | null;
  aiSuggestion: { marks_awarded: number; reasoning: string; confidence: 'low' | 'medium' | 'high' } | null;
  existingTutorMark: number | null;
}

export interface MergedQuestion {
  id: string;
  type: string;
  parts: MergedPart[];
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-[#E8F2ED] text-[#1A3D2E]',
  medium: 'bg-[#FEF9EC] text-[#B8963C]',
  low: 'bg-[#FDEDEC] text-[#C0392B]',
};

const initialState: SaveMarkingResult = {};

export default function MarkingForm({
  submissionId,
  studentName,
  subject,
  topic,
  submittedAt,
  scorePercentage,
  reviewed,
  existingFeedback,
  questions,
}: {
  submissionId: string;
  studentName: string;
  subject: string;
  topic: string;
  submittedAt: string;
  scorePercentage: number | null;
  reviewed: boolean;
  existingFeedback: string | null;
  questions: MergedQuestion[];
}) {
  const [state, formAction, pending] = useActionState(saveMarkingAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="submissionId" value={submissionId} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">
            {studentName} - {subject}
          </h1>
          <p className="text-sm text-[#5C5849]">
            {topic} - submitted {new Date(submittedAt).toLocaleDateString('en-GB')}
          </p>
        </div>
        <span
          className={`text-xs font-medium rounded-full px-2.5 py-1 ${
            reviewed ? 'bg-[#E8F2ED] text-[#1A3D2E]' : 'bg-[#FEF9EC] text-[#B8963C]'
          }`}
        >
          {reviewed ? `Reviewed${scorePercentage !== null ? ` - ${scorePercentage}%` : ''}` : 'Needs review'}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const divider = sectionDividerLabel(question, index, questions);
          const totalMarks = question.parts.reduce((sum, part) => sum + part.marks, 0);
          const isMultiPart = question.parts.length > 1;

          return (
            <div key={question.id}>
              {divider && (
                <p
                  className={`text-[9px] uppercase tracking-widest mb-2 mt-2 ${
                    divider === 'Warm-up' ? 'text-[#C8A84B]' : 'text-[#1A3D2E]'
                  }`}
                >
                  {divider}
                </p>
              )}
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-[#1A3D2E]">Q{index + 1}</span>
                  <span className="text-xs text-[#9A9080]">[{totalMarks}]</span>
                </div>

                <div className="flex flex-col gap-4">
                  {question.parts.map((part, partIndex) => (
                    <div key={partIndex} className={isMultiPart ? 'pl-4 border-l-2 border-[#E0D9D0]' : ''}>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-sm text-[#1A1A18] leading-relaxed">
                          {part.partLabel && <span className="font-medium">({part.partLabel}) </span>}
                          {part.text}
                        </p>
                        <span className="text-xs text-[#9A9080] whitespace-nowrap">[{part.marks}]</span>
                      </div>

                      <div className="text-sm text-[#1A1A18] bg-white border border-[#E0D9D0] rounded-[10px] px-4 py-3 mb-2">
                        {part.answered ? part.studentAnswer : <span className="italic text-[#9A9080]">Not answered</span>}
                      </div>

                      {!part.isExtended && part.answered && (
                        <p className="text-xs text-[#5C5849] mb-1">
                          <span className={part.tier1?.matched ? 'text-[#1A3D2E]' : 'text-[#C0392B]'}>
                            {part.tier1?.matched ? 'Correct' : 'Incorrect'}
                          </span>{' '}
                          - {part.tier1?.marksAwarded ?? 0}/{part.marks} marks - correct answer: {part.correctAnswer}
                        </p>
                      )}

                      {part.isExtended && part.answered && (
                        <div className="bg-[#E8F2ED] rounded-[10px] p-4 flex flex-col gap-2 mb-2">
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">M1:</span> {part.markScheme?.M1}
                          </p>
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">A1:</span> {part.markScheme?.A1}
                          </p>
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">Answer:</span> {part.correctAnswer}
                          </p>
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">Allow:</span> {part.markScheme?.allow}
                          </p>
                          <p className="text-xs text-[#1A3D2E]">
                            <span className="font-medium">Common error:</span> {part.markScheme?.commonError}
                          </p>

                          {part.aiSuggestion && (
                            <div className="flex items-start gap-2 pt-2 border-t border-[#C4B9AC]">
                              <span
                                className={`text-[9px] uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${
                                  CONFIDENCE_STYLES[part.aiSuggestion.confidence]
                                }`}
                              >
                                AI: {part.aiSuggestion.marks_awarded}/{part.marks} - {part.aiSuggestion.confidence}
                              </span>
                              <p className="text-xs text-[#5C5849]">{part.aiSuggestion.reasoning}</p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <label className="text-xs font-medium text-[#1A3D2E]" htmlFor={`mark:${question.id}:${partIndex}`}>
                              Marks awarded
                            </label>
                            <input
                              id={`mark:${question.id}:${partIndex}`}
                              name={`mark:${question.id}:${partIndex}`}
                              type="number"
                              min={0}
                              max={part.marks}
                              defaultValue={part.existingTutorMark ?? part.aiSuggestion?.marks_awarded ?? 0}
                              className="w-16 px-2 py-1 rounded-[8px] text-sm bg-white border border-[#E0D9D0] text-[#1A1A18] outline-none focus:border-[#1A3D2E]"
                            />
                            <span className="text-xs text-[#9A9080]">/ {part.marks}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={cardClass}>
        <label className={labelClass} htmlFor="feedback">
          Feedback for the student (optional)
        </label>
        <textarea
          id="feedback"
          name="feedback"
          rows={3}
          maxLength={2000}
          defaultValue={existingFeedback ?? ''}
          className={inputClass}
          placeholder="e.g. Great progress on solving equations - keep practising negative coefficients."
        />
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
      {state.success && <p className="text-sm text-[#1A3D2E]">Marking saved.</p>}
      {state.difficultyNotice && <p className="text-sm text-[#C8A84B]">{state.difficultyNotice}</p>}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Save marking'}
      </button>
    </form>
  );
}
