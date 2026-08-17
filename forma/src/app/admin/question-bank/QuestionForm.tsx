'use client';

import { useActionState } from 'react';
import { createQuestionAction, type QuestionBankActionResult } from './actions';
import { COUNTRIES, SUBJECTS } from '@/lib/constants';
import { ANSWER_FORMATS } from '@/lib/ai/schema';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

const initialState: QuestionBankActionResult = {};

const COUNTRY_LABELS: Record<string, string> = {
  england: 'England',
  canada_ontario: 'Canada (Ontario)',
  united_states: 'United States',
};

export default function QuestionForm() {
  const [state, formAction, pending] = useActionState(createQuestionAction, initialState);

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-semibold text-[#1A1A18]">Submit a question</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="country">
            Country
          </label>
          <select id="country" name="country" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select...
            </option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="curriculumLevel">
            Curriculum level
          </label>
          <input id="curriculumLevel" name="curriculumLevel" required className={inputClass} placeholder="e.g. GCSE" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="subject">
            Subject
          </label>
          <select id="subject" name="subject" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select...
            </option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="topic">
            Topic
          </label>
          <input id="topic" name="topic" required className={inputClass} placeholder="e.g. Simultaneous Equations" />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="subSkill">
          Sub-skill (optional)
        </label>
        <input id="subSkill" name="subSkill" className={inputClass} placeholder="e.g. Elimination method" />
        <p className="text-xs text-[#9A9080] mt-1">
          Not yet used by generation (Phase 7 Step 37 is unbuilt) - stored for when it is.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="text">
          Question text
        </label>
        <textarea id="text" name="text" required rows={3} maxLength={2000} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="marks">
            Marks
          </label>
          <input id="marks" name="marks" type="number" min={1} max={20} required defaultValue={1} className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="answerFormat">
            Answer format
          </label>
          <select id="answerFormat" name="answerFormat" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select...
            </option>
            {ANSWER_FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="answer">
          Answer
        </label>
        <input id="answer" name="answer" required className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="m1">
            M1 (method mark)
          </label>
          <input id="m1" name="m1" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="a1">
            A1 (accuracy mark)
          </label>
          <input id="a1" name="a1" required className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="commonError">
            Common error (optional)
          </label>
          <input id="commonError" name="commonError" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="allow">
            Allow (optional)
          </label>
          <input id="allow" name="allow" className={inputClass} />
        </div>
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Submit question'}
      </button>
    </form>
  );
}
