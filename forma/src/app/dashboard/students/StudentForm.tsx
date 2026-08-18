'use client';

import { useActionState, useState } from 'react';
import { createStudentAction, type CreateStudentResult } from './actions';
import { SUBJECTS } from '@/lib/constants';
import { inputClass, labelClass, primaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';

// student_profiles.curriculum_level is unconstrained TEXT (no DB CHECK), so
// this can follow the Country and Curriculum Catalogue's labels directly
// rather than the narrower CurriculumLevel enum in src/lib/ai/schema.ts,
// which scopes only the AI-generated worksheet's own `curriculum` field and
// omits AP/SAT/ACT.
const CURRICULUM_LEVELS_BY_COUNTRY: Record<string, string[]> = {
  england: ['KS2', 'KS3', 'GCSE', 'A-Level'],
  canada_ontario: ['Ontario Elementary', 'Ontario Secondary'],
  united_states: ['US Common Core', 'AP', 'SAT', 'ACT'],
};

const initialState: CreateStudentResult = {};

export default function StudentForm() {
  const [state, formAction, pending] = useActionState(createStudentAction, initialState);
  const [country, setCountry] = useState('england');

  return (
    <form action={formAction} className={`${accentCardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-semibold text-[#1A1A18]">Add a student</h2>

      <div>
        <label className={labelClass} htmlFor="name">
          Name
        </label>
        <input id="name" name="name" required maxLength={100} className={inputClass} placeholder="e.g. Naeto" />
      </div>

      <div>
        <label className={labelClass} htmlFor="country">
          Country
        </label>
        <select
          id="country"
          name="country"
          className={inputClass}
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="england">England</option>
          <option value="canada_ontario">Canada (Ontario)</option>
          <option value="united_states">United States</option>
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="curriculumLevel">
          Curriculum level
        </label>
        {/* key={country} remounts the select so a level from the previous
            country's list can't linger selected after switching country. */}
        <select key={country} id="curriculumLevel" name="curriculumLevel" defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select a level
          </option>
          {CURRICULUM_LEVELS_BY_COUNTRY[country].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="yearLevel">
          Year or grade
        </label>
        <input id="yearLevel" name="yearLevel" required className={inputClass} placeholder="e.g. Year 9" />
      </div>

      <div>
        <span className={labelClass}>Subjects</span>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((subject) => (
            <label
              key={subject}
              className="flex items-center gap-1.5 text-sm text-[#1A1A18] bg-white border border-[#E0D9D0] rounded-[10px] px-3 py-1.5 cursor-pointer"
            >
              <input type="checkbox" name="subjects" value={subject} className="accent-[#1A3D2E]" />
              {subject}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="email">
          Student email (optional)
        </label>
        <input
          id="email"
          name="email"
          type="email"
          maxLength={200}
          className={inputClass}
          placeholder="Leave blank to send worksheets to your own email instead"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="weaknesses">
          Weaknesses (optional)
        </label>
        <textarea
          id="weaknesses"
          name="weaknesses"
          rows={2}
          className={inputClass}
          placeholder="e.g. struggles with adding fractions with different denominators"
        />
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Add student'}
      </button>
    </form>
  );
}
