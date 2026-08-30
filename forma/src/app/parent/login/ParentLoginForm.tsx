'use client';

import { useActionState } from 'react';
import { Eye } from 'lucide-react';
import { parentLoginAction, type ParentPortalLoginState } from './actions';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

// W8 Wave B slice 2 (parent portal): the parent's login surface - the same
// username/password shape the founder set up, but it only opens THIS family's
// view-only proof portal. No email, no magic link. A parent who wants more
// asks the tutor directly (the founder flips the dials), matching the
// product-experience model's "the portal only reflects what your tutor has
// set" invariant.
export default function ParentLoginForm() {
  const [state, formAction, pending] = useActionState<ParentPortalLoginState, FormData>(parentLoginAction, {});

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-4`}>
      <div>
        <label className={labelClass} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          maxLength={100}
          required
          className={inputClass}
          placeholder="Your family username"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={200}
          required
          className={inputClass}
        />
      </div>

      {state.error && <p className="text-sm text-[#C0392B]">{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Logging in...' : 'Log in'}
      </button>

      <div className="flex items-start gap-2 pt-1">
        <Eye className="w-4 h-4 mt-0.5 text-[#1A3D2E] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-xs text-[#9A9080]">
          This portal is for keeping track - each child&apos;s progress, history, and your monthly statement. Anything you
          want changed, just tell your tutor directly.
        </p>
      </div>
    </form>
  );
}