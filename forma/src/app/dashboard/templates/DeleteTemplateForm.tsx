'use client';

import { deleteTemplateAction } from './actions';

export default function DeleteTemplateForm({ templateId }: { templateId: string }) {
  return (
    <form
      action={deleteTemplateAction}
      onSubmit={(event) => {
        if (!window.confirm('Delete this template?')) event.preventDefault();
      }}
    >
      <input type="hidden" name="templateId" value={templateId} />
      <button type="submit" className="text-xs text-[#C0392B]">
        Delete
      </button>
    </form>
  );
}
