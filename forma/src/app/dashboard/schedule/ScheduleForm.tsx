'use client';

import { useActionState } from 'react';
import { createScheduleAction, type ScheduleActionResult } from './actions';
import { SUBJECTS, DIFFICULTY_LEVELS, DELIVERY_TIMEZONES, DAY_OF_WEEK_LABELS } from '@/lib/constants';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

interface StudentOption {
  id: string;
  name: string;
}

function hourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

const initialState: ScheduleActionResult = {};

export default function ScheduleForm({ students }: { students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createScheduleAction, initialState);

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-semibold text-[#1A1A18]">Create a schedule</h2>

      <div>
        <label className={labelClass} htmlFor="studentId">
          Student
        </label>
        <select id="studentId" name="studentId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Select a student
          </option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="subject">
          Subject
        </label>
        <select id="subject" name="subject" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Select a subject
          </option>
          {SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="topics">
          Topics (optional, comma separated)
        </label>
        <input id="topics" name="topics" className={inputClass} placeholder="e.g. fractions, ratio, algebra basics" />
      </div>

      <div>
        <label className={labelClass} htmlFor="difficulty">
          Difficulty
        </label>
        <select id="difficulty" name="difficulty" className={inputClass} defaultValue="standard">
          {DIFFICULTY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level[0].toUpperCase() + level.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="dayOfWeek">
            Day
          </label>
          <select id="dayOfWeek" name="dayOfWeek" className={inputClass} defaultValue="1">
            {DAY_OF_WEEK_LABELS.map((label, value) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="deliveryHour">
            Time
          </label>
          <select id="deliveryHour" name="deliveryHour" className={inputClass} defaultValue="16">
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {hourLabel(hour)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="deliveryTimezone">
          Timezone
        </label>
        <select id="deliveryTimezone" name="deliveryTimezone" className={inputClass} defaultValue="Europe/London">
          {DELIVERY_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Create schedule'}
      </button>
    </form>
  );
}
