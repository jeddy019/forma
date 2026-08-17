'use client';

import { useState } from 'react';
import type { WorksheetQuestion } from '@/lib/pdf/worksheet-template';
import { renderDiagramSvg } from '@/lib/diagrams/renderDiagramSpec';
import { sectionDividerLabel } from '@/lib/worksheet/sectionDividerLabel';

type Phase = 'idle' | 'submitting' | 'success' | 'error';

const inputClass =
  'w-full px-4 py-[14px] rounded-[10px] text-sm bg-white border border-[#E0D9D0] text-[#1A1A18] placeholder:text-[#9A9080] placeholder:italic outline-none focus:border-[#1A3D2E] focus:shadow-[0_0_0_3px_rgba(26,61,46,0.12)] transition-colors duration-200';

const primaryButtonClass =
  'px-6 py-3 rounded-[10px] text-sm font-medium bg-[#1A3D2E] text-white hover:bg-[#152F23] transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed';

const cardClass =
  'bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.05)]';

export default function StudentWorksheetForm({
  digitalCode,
  questions,
}: {
  digitalCode: string;
  questions: WorksheetQuestion[];
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function setAnswer(questionId: string, partIndex: number, value: string) {
    setAnswers((prev) => {
      const next = [...(prev[questionId] ?? [])];
      next[partIndex] = value;
      return { ...prev, [questionId]: next };
    });
  }

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
      <div className={`${cardClass} text-center`}>
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-1" style={{ fontFamily: 'var(--font-playfair)' }}>
          Answers submitted
        </h2>
        <p className="text-sm text-[#5C5849]">Your tutor will review your work soon.</p>
      </div>
    );
  }

  return (
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
                  <div key={partIndex} className={isMultiPart ? 'pl-4' : ''}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm text-[#1A1A18] leading-relaxed">
                        {part.part_label && (
                          <span className="font-medium">({part.part_label}) </span>
                        )}
                        {part.text}
                      </p>
                      <span className="text-xs text-[#9A9080] whitespace-nowrap">[{part.marks}]</span>
                    </div>
                    {part.diagram_spec && (
                      <div
                        className="my-2 flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                        dangerouslySetInnerHTML={{ __html: renderDiagramSvg(part.diagram_spec) }}
                      />
                    )}
                    <textarea
                      rows={2}
                      maxLength={2000}
                      className={inputClass}
                      placeholder="Type your answer"
                      value={answers[question.id]?.[partIndex] ?? ''}
                      onChange={(event) => setAnswer(question.id, partIndex, event.target.value)}
                      disabled={phase === 'submitting'}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {phase === 'error' && errorMessage && <p className="text-sm text-[#C0392B]">{errorMessage}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={phase === 'submitting'}
        className={`${primaryButtonClass} self-start`}
      >
        {phase === 'submitting' ? 'Submitting...' : 'Submit answers'}
      </button>
    </div>
  );
}
