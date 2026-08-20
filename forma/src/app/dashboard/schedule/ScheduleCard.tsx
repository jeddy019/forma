'use client';

import { useActionState, useState } from 'react';
import { updateScheduleAction, pauseScheduleAction, resumeScheduleAction, deleteScheduleAction, type ScheduleActionResult } from './actions';
import { CORE_SUBJECTS, CODING_SUBJECTS, DIFFICULTY_LEVELS, DELIVERY_TIMEZONES, DAY_OF_WEEK_LABELS } from '@/lib/constants';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, cardClass } from '@/lib/ui/formStyles';

export interface ScheduleRow {
  id: string;
  student_id: string;
  subject: string;
  topics: string[] | null;
  difficulty: string;
  day_of_week: number;
  delivery_hour: number;
  delivery_timezone: string;
  is_paused: boolean;
  paused_until: string | null;
  last_generated_at: string | null;
  student: { name: string } | null;
}

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

export default function ScheduleCard({ schedule, students }: { schedule: ScheduleRow; students: StudentOption[] }) {
  const [editing, setEditing] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [updateState, updateFormAction, updatePending] = useActionState(updateScheduleAction, initialState);

  // useActionState's own return value doesn't close the edit form on
  // success - without this, the card stays stuck in edit mode forever after
  // a successful save. Adjusted during render (React's documented pattern
  // for "state derived from a changed value"), not in a useEffect - a
  // setState call synchronously inside an effect body is flagged by
  // react-hooks/set-state-in-effect and causes an extra cascading render.
  const [seenUpdateState, setSeenUpdateState] = useState(updateState);
  if (updateState !== seenUpdateState) {
    setSeenUpdateState(updateState);
    if (updateState.success) setEditing(false);
  }

  const now = new Date();
  const pausedUntilDate = schedule.paused_until ? new Date(schedule.paused_until) : null;
  const scheduledPause = pausedUntilDate !== null && pausedUntilDate > now;
  const status = schedule.is_paused ? 'Paused' : scheduledPause ? `Paused until ${pausedUntilDate!.toLocaleDateString('en-GB')}` : 'Active';
  const statusStyle = status === 'Active' ? 'bg-[#E8F2ED] text-[#1A3D2E]' : 'bg-[#FEF9EC] text-[#B8963C]';

  if (editing) {
    return (
      <form action={updateFormAction} className={`${cardClass} flex flex-col gap-4`}>
        <input type="hidden" name="scheduleId" value={schedule.id} />
        <h3 className="text-sm font-semibold text-[#1A1A18]">Edit schedule</h3>

        <div>
          <label className={labelClass} htmlFor={`studentId-${schedule.id}`}>
            Student
          </label>
          <select id={`studentId-${schedule.id}`} name="studentId" required className={inputClass} defaultValue={schedule.student_id}>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`subject-${schedule.id}`}>
            Subject
          </label>
          <select id={`subject-${schedule.id}`} name="subject" required className={inputClass} defaultValue={schedule.subject}>
            {CORE_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
            <optgroup label="Computer Science">
              {CODING_SUBJECTS.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor={`topics-${schedule.id}`}>
            Topics (optional, comma separated)
          </label>
          <input
            id={`topics-${schedule.id}`}
            name="topics"
            className={inputClass}
            defaultValue={(schedule.topics ?? []).join(', ')}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor={`difficulty-${schedule.id}`}>
            Difficulty
          </label>
          <select id={`difficulty-${schedule.id}`} name="difficulty" className={inputClass} defaultValue={schedule.difficulty}>
            {DIFFICULTY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level[0].toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor={`dayOfWeek-${schedule.id}`}>
              Day
            </label>
            <select id={`dayOfWeek-${schedule.id}`} name="dayOfWeek" className={inputClass} defaultValue={schedule.day_of_week}>
              {DAY_OF_WEEK_LABELS.map((label, value) => (
                <option key={label} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor={`deliveryHour-${schedule.id}`}>
              Time
            </label>
            <select id={`deliveryHour-${schedule.id}`} name="deliveryHour" className={inputClass} defaultValue={schedule.delivery_hour}>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {hourLabel(hour)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor={`deliveryTimezone-${schedule.id}`}>
            Timezone
          </label>
          <select
            id={`deliveryTimezone-${schedule.id}`}
            name="deliveryTimezone"
            className={inputClass}
            defaultValue={schedule.delivery_timezone}
          >
            {DELIVERY_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {updateState.error && <p className="text-sm text-[#C0392B]">{updateState.error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={updatePending} className={primaryButtonClass}>
            {updatePending ? 'Saving...' : 'Save changes'}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-sm font-medium text-[#1A1A18]">
            {schedule.student?.name ?? 'Student'} - {schedule.subject}
          </p>
          <p className="text-xs text-[#9A9080]">
            {DAY_OF_WEEK_LABELS[schedule.day_of_week]}s at {hourLabel(schedule.delivery_hour)} ({schedule.delivery_timezone.replace('_', ' ')})
          </p>
        </div>
        <span className={`text-xs font-medium rounded-full px-2.5 py-1 shrink-0 ${statusStyle}`}>{status}</span>
      </div>

      {schedule.topics && schedule.topics.length > 0 && (
        <p className="text-xs text-[#5C5849] mb-1">Topics: {schedule.topics.join(', ')}</p>
      )}
      <p className="text-xs text-[#9A9080] mb-3">
        {schedule.last_generated_at
          ? `Last sent ${new Date(schedule.last_generated_at).toLocaleDateString('en-GB')}`
          : 'Not sent yet'}
      </p>

      {pausing && (
        <form
          action={pauseScheduleAction}
          className="flex items-end gap-3 mb-3 bg-[#F0EBE3] rounded-[10px] p-3"
          onSubmit={() => setPausing(false)}
        >
          <input type="hidden" name="scheduleId" value={schedule.id} />
          <div>
            <label className={labelClass} htmlFor={`pausedUntil-${schedule.id}`}>
              Resume automatically on (optional)
            </label>
            <input id={`pausedUntil-${schedule.id}`} name="pausedUntil" type="date" className={inputClass} />
          </div>
          <button type="submit" className={secondaryButtonClass}>
            Confirm pause
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-[#1A3D2E] font-medium">
          Edit
        </button>
        {status === 'Active' ? (
          <button type="button" onClick={() => setPausing((v) => !v)} className="text-sm text-[#5C5849]">
            Pause
          </button>
        ) : (
          <form action={resumeScheduleAction}>
            <input type="hidden" name="scheduleId" value={schedule.id} />
            <button type="submit" className="text-sm text-[#1A3D2E] font-medium">
              Resume now
            </button>
          </form>
        )}
        <form
          action={deleteScheduleAction}
          onSubmit={(event) => {
            if (!window.confirm('Remove this schedule? This cannot be undone.')) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="scheduleId" value={schedule.id} />
          <button type="submit" className="text-sm text-[#C0392B]">
            Remove
          </button>
        </form>
      </div>
    </div>
  );
}
