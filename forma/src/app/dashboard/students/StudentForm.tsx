'use client';

import { useActionState, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { createStudentAction, type StudentFormResult } from './actions';
import { CORE_SUBJECTS, CODING_SUBJECTS, COMING_SOON_SUBJECTS, EXAM_BOARDS_BY_COUNTRY, CURRICULUM_LEVELS_BY_COUNTRY, type Country } from '@/lib/constants';
import { inputClass, labelClass, primaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

const initialState: StudentFormResult = {};

export default function StudentForm({ isTutor }: { isTutor: boolean }) {
  const [state, formAction, pending] = useActionState(createStudentAction, initialState);
  const [country, setCountry] = useState<Country>('england');

  return (
    <form action={formAction} className={`${accentCardClass} flex flex-col gap-4`}>
      <FormHeader icon={UserPlus} title="Add a student" />

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
          onChange={(event) => setCountry(event.target.value as Country)}
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

      {/* B67 (exam board selection): only shown for countries that actually
          have exam boards in this sense (England AQA/Edexcel/OCR/CIE, US
          SAT/ACT). Ontario has no single awarding body, so it gets no picker
          and no value. Optional - "No specific board" stores a NULL, which is
          a valid choice for a student not prepping for one. */}
      {EXAM_BOARDS_BY_COUNTRY[country].length > 0 && (
        <div>
          <label className={labelClass} htmlFor="examBoard">
            Exam board (optional)
          </label>
          <select id="examBoard" name="examBoard" defaultValue="" className={inputClass}>
            <option value="">No specific board</option>
            {EXAM_BOARDS_BY_COUNTRY[country].map((board) => (
              <option key={board} value={board}>
                {board}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass} htmlFor="yearLevel">
          Year or grade
        </label>
        <input id="yearLevel" name="yearLevel" required className={inputClass} placeholder="e.g. Year 9" />
      </div>

      <div>
        <span className={labelClass}>Subjects</span>
        <div className="flex flex-wrap gap-2">
          {CORE_SUBJECTS.map((subject) => (
            <label
              key={subject}
              className="flex items-center gap-1.5 text-sm text-[#1A1A18] bg-white border border-[#E0D9D0] rounded-[10px] px-3 py-1.5 cursor-pointer"
            >
              <input type="checkbox" name="subjects" value={subject} className="accent-[#1A3D2E]" />
              {subject}
            </label>
          ))}
        </div>

        <div className="mt-3">
          <span className="text-xs text-[#9A9080]">Computer Science</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {CODING_SUBJECTS.map((subject) => (
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

        {/* Deliberately non-interactive - no input, no click handler, no
            name attribute, so nothing here can ever be submitted. Purely a
            roadmap signal on the actual subject-selection UI, per the
            user's explicit "show it clearly but do not make it clickable". */}
        <div className="mt-3">
          <span className="text-xs text-[#9A9080]">More subjects coming soon</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {COMING_SOON_SUBJECTS.map((subject) => (
              <span
                key={subject}
                className="text-sm text-[#9A9080] bg-[#F0EBE3] border border-[#E0D9D0] rounded-[10px] px-3 py-1.5 cursor-default"
              >
                {subject}
              </span>
            ))}
          </div>
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

      {isTutor && (
        <div>
          <label className={labelClass} htmlFor="parentEmail">
            Parent email (optional)
          </label>
          <input
            id="parentEmail"
            name="parentEmail"
            type="email"
            maxLength={200}
            className={inputClass}
            placeholder="For sending parent progress reports"
          />
        </div>
      )}

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
