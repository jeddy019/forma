import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashPortalSessionToken, PORTAL_SESSION_COOKIE } from '@/lib/portal/session';

// W8 Wave B (portal accounts): the shared, server-only session resolution.
// Lives outside the 'use server' action files so any server component or
// action can read the portal session the same way (login sets it, the
// /student and /parent pages read it, sign-out clears it). Only ever called
// from server code; never import this from a client module.

export interface ResolvedPortalSession {
  /** The raw cookie value - needed by sign-out to delete the DB row. */
  raw: string;
  account: {
    id: string;
    kind: 'student' | 'parent';
    student_id: string | null;
    family_id: string | null;
  };
}

// portal_accounts and portal_sessions are deny-all RLS, so this resolution
// uses the admin client - the same service-role pattern as /s/[code] and
// /api/submit (Security Rules 1).
export async function resolvePortalSession(kind: 'student' | 'parent'): Promise<ResolvedPortalSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const admin = createAdminClient();
  const { data: sessions } = await admin
    .from('portal_sessions')
    .select('account_id, expires_at')
    .eq('token_hash', hashPortalSessionToken(raw))
    .limit(1)
    .returns<{ account_id: string; expires_at: string }[]>();

  const session = sessions?.[0];
  if (!session || session.expires_at <= new Date().toISOString()) {
    return null;
  }

  const { data: accountRows } = await admin
    .from('portal_accounts')
    .select('id, kind, student_id, family_id')
    .eq('id', session.account_id)
    .limit(1)
    .returns<{ id: string; kind: 'student' | 'parent'; student_id: string | null; family_id: string | null }[]>();

  const account = accountRows?.[0];
  if (!account || account.kind !== kind) return null;
  return { raw, account };
}

// Deletes the session row and clears the cookie. Safe to call even with no
// session present (used by the sign-out actions).
export async function clearPortalSession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(PORTAL_SESSION_COOKIE)?.value;
  if (raw) {
    const admin = createAdminClient();
    await admin.from('portal_sessions').delete().eq('token_hash', hashPortalSessionToken(raw));
  }
  cookieStore.delete(PORTAL_SESSION_COOKIE);
}