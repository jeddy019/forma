'use client';

import { useActionState } from 'react';
import { KeyRound } from 'lucide-react';
import { portalLoginAction, type PortalLoginState } from './actions';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

// W8 Wave B (portal accounts): the student's login surface. No email, no
// magic link, no sign-up - the founder provisions a username + password at
// enrollment and hands it over once. The colourful practice content stays
// behind every OTHER link (the /s/[code] and /q/[code] routes need no login
// at all) - this page is only for the child who wants to see their own
// progress over time (never a gate).
export default function StudentLoginForm() {
  const [state, formAction, pending] = useActionState<PortalLoginState, FormData>(portalLoginAction, {});

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
          placeholder="The username your tutor set up (e.g. aisha-kxqr)"
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
        <KeyRound className="w-4 h-4 mt-0.5 text-[#1A3D2E] shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-xs text-[#9A9080]">
          No login needed for practice - just open the link your tutor sends each day. Logging in only shows your
          own history and progress.
        </p>
      </div>
    </form>
  );
}