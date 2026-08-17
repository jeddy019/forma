import { Resend } from 'resend';

// RESEND_API_KEY is server-only (Security Rules 5) - this module must never
// be imported from a 'use client' file.
//
// Real bug found live (Phase 4 Step 22 session): `new Resend(undefined)`
// throws synchronously ("Missing API key") rather than deferring the check
// to .emails.send() - constructing this eagerly at module load, as the
// first version of this file did, crashed every route that imports send.tsx
// (signup's welcome email, this cron job) the moment RESEND_API_KEY is
// unset, before send.tsx's own "never throw" try/catch ever got a chance to
// run. Lazy getter instead: nothing constructs the SDK client at all until
// a send is actually attempted, and send.tsx checks RESEND_API_KEY itself
// before calling this, so the constructor never even runs while the key is
// missing.
let client: Resend | null = null;

export function getResendClient(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

// worksheets@forma.app (per CLAUDE.md's Email Templates section) needs a
// verified custom domain on Resend, which doesn't exist yet - using
// Resend's own onboarding@resend.dev sender in the meantime (per the user).
// Resend restricts an unverified account to sending only to the account's
// own owner email regardless of the `to` address, until a domain is
// verified - expected, not a bug, per the user. Swap back to
// worksheets@forma.app once a custom domain is verified on Resend.
export const EMAIL_FROM = 'Forma <onboarding@resend.dev>';
