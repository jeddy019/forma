'use client';

import { useActionState } from 'react';
import { Home } from 'lucide-react';
import { createFamilyAction, type FamilyActionResult } from './actions';
import { inputClass, labelClass, primaryButtonClass, accentCardClass } from '@/lib/ui/formStyles';
import { FormHeader } from '@/lib/ui/FormHeader';

// W4 family plan: the accent-railed "create a family" form - this is the
// one primary action on the Families page. A family is one parent's
// household of 1-3 students; the price is computed from its child count and
// shown on each family card below.
export default function FamilyForm() {
  const [state, formAction, pending] = useActionState<FamilyActionResult, FormData>(createFamilyAction, {});

  return (
    <form action={formAction} className={`${accentCardClass} flex flex-col gap-3`}>
      <FormHeader icon={Home} title="Add a family" />

      <div>
        <label className={labelClass} htmlFor="family-name">
          Family name
        </label>
        <input
          id="family-name"
          name="name"
          type="text"
          maxLength={100}
          placeholder="For example: Adaeze or the Bello family"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="family-parent-email">
          Parent email <span className="font-normal text-[#9A9080]">(optional)</span>
        </label>
        <input
          id="family-parent-email"
          name="parentEmail"
          type="email"
          maxLength={200}
          placeholder="The parent who pays - used for their weekly report and invoice"
          className={inputClass}
        />
      </div>

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Adding...' : 'Add family'}
      </button>

      {state.success && <p className="text-sm text-[#1A3D2E]">Family added - now add children to it.</p>}
      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}
    </form>
  );
}