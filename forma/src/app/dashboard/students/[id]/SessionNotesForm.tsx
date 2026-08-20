'use client';

import { useActionState, useEffect, useRef } from 'react';
import { NotebookPen } from 'lucide-react';
import { addSessionNoteAction, type AddSessionNoteResult } from './actions';
import { inputClass, labelClass, primaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

const CONTENT_MAX_LENGTH = 5000;
const initialState: AddSessionNoteResult = {};

export default function SessionNotesForm({ studentId }: { studentId: string }) {
  const [state, formAction, pending] = useActionState(addSessionNoteAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Clears the textarea after a successful save, same "reset on success"
  // pattern StudentForm doesn't need (it navigates away via the list
  // re-render) but this page stays put, so the form must clear itself.
  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className={`${accentCardClass} flex flex-col gap-3`}>
      <input type="hidden" name="studentId" value={studentId} />
      <FormHeader icon={NotebookPen} title="Add a session note" />
      <label className={labelClass} htmlFor="content">
        Notes
      </label>
      <textarea
        id="content"
        name="content"
        rows={4}
        maxLength={CONTENT_MAX_LENGTH}
        className={inputClass}
        placeholder="e.g. Naeto found adding fractions with different denominators difficult today - needs more practice finding a common denominator before the next session."
      />
      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Saving...' : 'Save note'}
      </button>
    </form>
  );
}
