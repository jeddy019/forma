'use server';

import { redirect } from 'next/navigation';
import { runPortalLogin } from '@/lib/portal/login';

// W8 Wave B (portal accounts): the student login server action. Replaces the
// Phase 6 email/OTP flow - the founder model requires NO email from a child,
// and portal credentials (username + generated password) are auto-provisioned
// at enrollment and shown once. All the shared auth work (lockout, session
// creation, cookie) lives in src/lib/portal/login.ts - this action only
// picks the audience, so /parent/login behaves identically by construction.
export interface PortalLoginState {
  error?: string;
}

export async function portalLoginAction(
  _prev: PortalLoginState,
  formData: FormData
): Promise<PortalLoginState> {
  const outcome = await runPortalLogin(
    'student',
    String(formData.get('username') ?? ''),
    String(formData.get('password') ?? '')
  );
  if (!outcome.ok) {
    return { error: outcome.error };
  }
  redirect(outcome.redirectTo as string);
}