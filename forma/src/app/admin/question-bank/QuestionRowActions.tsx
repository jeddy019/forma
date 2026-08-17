'use client';

import { verifyQuestionAction, deleteQuestionAction } from './actions';

export default function QuestionRowActions({ id, verified }: { id: string; verified: boolean }) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      {!verified && (
        <form action={verifyQuestionAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="text-xs text-[#1A3D2E] font-medium">
            Mark verified
          </button>
        </form>
      )}
      <form
        action={deleteQuestionAction}
        onSubmit={(event) => {
          if (!window.confirm('Delete this question?')) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-xs text-[#C0392B]">
          Delete
        </button>
      </form>
    </div>
  );
}
