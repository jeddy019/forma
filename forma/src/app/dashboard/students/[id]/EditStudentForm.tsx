'use client';

import { useActionState, useState } from 'react';
import { UserCog } from 'lucide-react';
import { updateStudentAction, type StudentFormResult } from '../actions';
import { CORE_SUBJECTS, CODING_SUBJECTS, EXAM_BOARDS_BY_COUNTRY, CURRICULUM_LEVELS_BY_COUNTRY, type Country } from '@/lib/constants';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

export interface EditableStudent {
  id: string;
  name: string | null;
  country: Country;
  curriculum_level: string | null;
  year_level: string | null;
  exam_board: string | null;
  subjects: string[] | null;
  weaknesses: string | null;
}

const initialState: StudentFormResult = {};

export default function EditStudentForm({ student }: { student: EditableStudent }) {
  const [state, formAction, pending] = useActionState(
    updateStudentAction.bind(null, student.id),
    initialState
  );
  const [country, setCountry] = useState<Country>(student.country);
  const currentSubjects = student.subjects ?? [];

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-4`}>
      <FormHeader icon={UserCog} title="Edit student details" />

      <div>
        <label className={labelClass} htmlFor={`edit-name-${student.id}`}>
          Name
        </label>
        <input
          id={`edit-name-${student.id}`}
          name="name"
          required
          maxLength={100}
          defaultValue={student.name ?? ''}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor={`edit-country-${student.id}`}>
          Country
        </label>
        <select
          id={`edit-country-${student.id}`}
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
        <label className={labelClass} htmlFor={`edit-level-${student.id}`}>
          Curriculum level
        </label>
        {/* key={country} remounts the select so a level from the previous
            country's list can't linger selected after switching country. */}
        <select
          key={country}
          id={`edit-level-${student.id}`}
          name="curriculumLevel"
          defaultValue={student.curriculum_level ?? ''}
          className={inputClass}
        >
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

      {EXAM_BOARDS_BY_COUNTRY[country].length > 0 && (
        <div>
          <label className={labelClass} htmlFor={`edit-board-${student.id}`}>
            Exam board (optional)
          </label>
          <select
            id={`edit-board-${student.id}`}
            name="examBoard"
            defaultValue={student.exam_board ?? ''}
            className={inputClass}
          >
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
        <label className={labelClass} htmlFor={`edit-year-${student.id}`}>
          Year or grade
        </label>
        <input
          id={`edit-year-${student.id}`}
          name="yearLevel"
          required
          defaultValue={student.year_level ?? ''}
          className={inputClass}
        />
      </div>

      <div>
        <span className={labelClass}>Subjects</span>
        <div className="flex flex-wrap gap-2">
          {CORE_SUBJECTS.map((subject) => (
            <label
              key={subject}
              className="flex items-center gap-1.5 text-sm text-[#1A1A18] bg-white border border-[#E0D9D0] rounded-[10px] px-3 py-1.5 cursor-pointer"
            >
              <input
                type="checkbox"
                name="subjects"
                value={subject}
                defaultChecked={currentSubjects.includes(subject)}
                className="accent-[#1A3D2E]"
              />
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
                <input
                  type="checkbox"
                  name="subjects"
                  value={subject}
                  defaultChecked={currentSubjects.includes(subject)}
                  className="accent-[#1A3D2E]"
                />
                {subject}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor={`edit-weaknesses-${student.id}`}>
          Weaknesses (optional)
        </label>
        <textarea
          id={`edit-weaknesses-${student.id}`}
          name="weaknesses"
          rows={2}
          defaultValue={student.weaknesses ?? ''}
          className={inputClass}
        />
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
      {state.success && <p className="text-sm text-[#1A3D2E]">Student details saved.</p>}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Save changes'}
      </button>
    </form>
  );
}