'use server';

import { redirect } from 'next/navigation';
import { runPortalLogin } from '@/lib/portal/login';

// W8 Wave B slice 2 (parent portal): the parent login server action.
// Identical mechanics to the student login - both funnel through
// src/lib/portal/login.ts's shared core, differing only in the account kind
// (which restricts login to accounts that own a FAMILY, never a student) and
// the landing page.
export interface ParentPortalLoginState {
  error?: string;
}

export async function parentLoginAction(
  _prev: ParentPortalLoginState,
  formData: FormData
): Promise<ParentPortalLoginState> {
  const outcome = await runPortalLogin(
    'parent',
    String(formData.get('username') ?? ''),
    String(formData.get('password') ?? '')
  );
  if (!outcome.ok) {
    return { error: outcome.error };
  }
  redirect(outcome.redirectTo as string);
}