'use client';

// Phase B Wave 1 (B11): smart learning "Study now". A client component that
// calls the student-authenticated /api/quiz/study route - with no target it
// auto-recommends (a topic due for spaced review, else the lowest-mastery
// sub-skill) - and navigates straight into the freshly generated quiz, so the
// whole loop is one tap. The portal page is an RSC, so this thin client island
// carries the interactive fetch + navigation.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export interface StudyTarget {
  subSkill: string;
  label: string;
}

export default function StudyNow({ target }: { target?: StudyTarget | null }) {
  const router = useRouter();
  const [labelling, setLabelling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading = labelling !== null;

  async function start() {
    if (loading) return;
    setLabelling('Choosing what to practise...');
    setError(null);
    try {
      const res = await fetch('/api/quiz/study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: target ?? null }),
      });
      const data = (await res.json()) as { error?: string; quiz?: { digital_code?: string }; target?: StudyTarget | null };
      if (!res.ok || !data.quiz?.digital_code) {
        setError(data.error ?? 'Could not start a study session.');
        return;
      }
      setLabelling((data.target?.label ? `Showing you: ${data.target.label}` : null) ?? `Starting your session...`);
      router.push(`/q/${data.quiz.digital_code}`);
    } catch {
      setError('Connection lost. Please try again.');
    } finally {
      setLabelling(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] text-sm font-medium bg-[#C8A84B] text-white hover:bg-[#B8963C] active:scale-[0.98] transition-all duration-micro ease-premium disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} aria-hidden="true" />
        {loading ? labelling : target ? `Study: ${target.label}` : 'Study now'}
      </button>
      {!loading && error && <p className="text-xs text-[#C0392B] animate-fade-up">{error}</p>}
    </div>
  );
}
