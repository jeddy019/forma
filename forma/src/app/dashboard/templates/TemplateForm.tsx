'use client';

import { useActionState } from 'react';
import { createTemplateAction, type TemplateActionResult } from './actions';
import { SUBJECTS, DIFFICULTY_LEVELS } from '@/lib/constants';
import { inputClass, labelClass, primaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';

const initialState: TemplateActionResult = {};

export default function TemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplateAction, initialState);

  return (
    <form action={formAction} className={`${accentCardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-semibold text-[#1A1A18]">New template</h2>

      <div>
        <label className={labelClass} htmlFor="name">
          Name
        </label>
        <input id="name" name="name" required maxLength={100} className={inputClass} placeholder="e.g. GCSE Maths - Fractions Recap" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="subject">
            Subject
          </label>
          <select id="subject" name="subject" defaultValue="" className={inputClass}>
            <option value="">Any</option>
            {SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="difficulty">
            Difficulty
          </label>
          <select id="difficulty" name="difficulty" defaultValue="" className={inputClass}>
            <option value="">Any</option>
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="notes">
          Topic prompt
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1000}
          className={inputClass}
          placeholder="e.g. Struggles with adding fractions with different denominators - focus on finding a common denominator first."
        />
        <p className="text-xs text-[#9A9080] mt-1">Filled into the topic box automatically when this template is used.</p>
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Save template'}
      </button>
    </form>
  );
}
