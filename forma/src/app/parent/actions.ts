'use server';

import { redirect } from 'next/navigation';
import { clearPortalSession } from '@/lib/portal/server';

// W8 Wave B slice 2 (parent portal): sign-out for the parent portal. Same
// shared clearPortalSession as the student portal - revokes the session row
// server-side, not just the cookie - then returns to /parent/login.
export async function parentSignOutAction() {
  await clearPortalSession();
  redirect('/parent/login');
}