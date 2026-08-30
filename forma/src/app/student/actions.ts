'use server';

import { redirect } from 'next/navigation';
import { clearPortalSession } from '@/lib/portal/server';

// W8 Wave B (portal accounts): portal sign-out for the student portal. Deletes
// the session row (revoking the token server-side, not just clearing the
// cookie) and returns to the student login page. (The parent portal reuses
// the same clearPortalSession lib in its own sign-out action.)
export async function portalSignOutAction() {
  await clearPortalSession();
  redirect('/student/login');
}