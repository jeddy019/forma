import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPortalPassword } from '@/lib/portal/password';
import { createPortalSessionToken, PORTAL_SESSION_COOKIE, PORTAL_SESSION_TTL_MS } from '@/lib/portal/session';

// W8 Wave B (portal accounts): the shared portal-login core, used by BOTH the
// /student and /parent login actions so brute-force throttling, session
// creation, and cookie handling live in exactly one place. Server-only
// (calls cookies()) - imported by 'use server' actions, never a client
// module. The action that calls it decides where to redirect from the
// returned target; this function never redirects itself.
//
// Brute-force: 10 failed attempts lock the account for 15 minutes. Throttling
// state lives in the DB, not a per-instance memory counter - so arbitrary
// instances share the same lock.

export const MAX_PORTAL_FAILED_ATTEMPTS = 10;
export const PORTAL_LOCK_MS = 15 * 60 * 1000;
const USERNAME_MAX = 100;
const PASSWORD_MAX = 200;

export interface PortalLoginOutcome {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

interface PortalAccountRow {
  id: string;
  password_hash: string;
  failed_attempts: number | null;
  locked_until: string | null;
}

export async function runPortalLogin(
  kind: 'student' | 'parent',
  rawUsername: string,
  password: string
): Promise<PortalLoginOutcome> {
  const username = rawUsername.trim();
  if (!username || !password) {
    return { ok: false, error: 'Enter your username and password.' };
  }
  if (username.length > USERNAME_MAX || password.length > PASSWORD_MAX) {
    return { ok: false, error: 'That username and password do not match.' };
  }

  const admin = createAdminClient();
  const { data: accounts } = await admin
    .from('portal_accounts')
    .select('id, password_hash, failed_attempts, locked_until')
    .ilike('username', username)
    .eq('kind', kind)
    .limit(1)
    .returns<PortalAccountRow[]>();

  const account = accounts?.[0];
  const genericError = 'That username and password do not match.';
  if (!account) {
    return { ok: false, error: genericError };
  }

  // Locked accounts reject before any password work, so repeated guessing
  // cannot even reach the scrypt cost.
  if (account.locked_until && account.locked_until > new Date().toISOString()) {
    return { ok: false, error: 'Too many attempts - try again in 15 minutes.' };
  }

  if (!verifyPortalPassword(password, account.password_hash)) {
    const attempts = (account.failed_attempts ?? 0) + 1;
    await admin
      .from('portal_accounts')
      .update({
        failed_attempts: attempts,
        locked_until: attempts >= MAX_PORTAL_FAILED_ATTEMPTS ? new Date(Date.now() + PORTAL_LOCK_MS).toISOString() : null,
      })
      .eq('id', account.id);
    return { ok: false, error: genericError };
  }

  await admin
    .from('portal_accounts')
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq('id', account.id);

  const { raw, tokenHash } = createPortalSessionToken();
  await admin.from('portal_sessions').insert({
    account_id: account.id,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + PORTAL_SESSION_TTL_MS).toISOString(),
  });

  const cookieStore = await cookies();
  cookieStore.set(PORTAL_SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PORTAL_SESSION_TTL_MS / 1000,
  });

  return { ok: true, redirectTo: kind === 'student' ? '/student' : '/parent' };
}