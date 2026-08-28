'use client';

import { useActionState, useRef, useState } from 'react';
import { importQuestionsAction, type QuestionBankImportResult } from './actions';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

const initialState: QuestionBankImportResult = {};

export default function ImportForm() {
  const [state, formAction, pending] = useActionState(importQuestionsAction, initialState);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="text-lg font-semibold text-[#1A1A18]">Import questions</h2>

      <div>
        <label className={labelClass} htmlFor="file">
          JSON file
        </label>
        <input
          ref={fileRef}
          id="file"
          name="file"
          type="file"
          accept=".json,application/json"
          className={inputClass}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
        />
        <p className="text-xs text-[#9A9080] mt-1">{fileName ? `Selected: ${fileName}` : 'Upload an extracted JSON array - or skip this and paste below.'}</p>
      </div>

      <div>
        <label className={labelClass} htmlFor="json">
          Or paste JSON
        </label>
        <textarea
          id="json"
          name="json"
          rows={12}
          placeholder='[{"country":"england","curriculum_level":"GCSE","subject":"Mathematics","topic":"Simultaneous Equations","sub_skill":"elimination method","question":{"text":"...","marks":2,"answer_format":"numerical","answer":"...","mark_scheme":{"M1":"...","A1":"..."}}}]'
          className={inputClass}
        />
        <p className="text-xs text-[#9A9080] mt-1">
          Array of records in the import contract - see question-bank-import.example.json. Imported rows are marked verified automatically.
        </p>
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}

      {state.success && state.summary && (
        <div className="rounded-[10px] bg-[#E8F2ED] px-4 py-3 text-sm text-[#1A3D2E]">
          <p className="font-medium mb-1">
            Imported {state.summary.inserted} of {state.summary.total} questions
            {state.summary.skippedExisting > 0 && ` (${state.summary.skippedExisting} already in the bank)`}
            {state.summary.failed > 0 && `, ${state.summary.failed} failed`}.
          </p>
          {state.summary.failures.length > 0 && (
            <ul className="list-disc pl-5 text-xs text-[#5C5849] space-y-0.5 max-h-40 overflow-y-auto">
              {state.summary.failures.map((failure, i) => (
                <li key={i}>{failure}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} self-start`}>
        {pending ? 'Importing...' : 'Import questions'}
      </button>
    </form>
  );
}