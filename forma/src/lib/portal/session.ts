import { createHash, randomBytes } from 'node:crypto';

// W8 Wave B (portal accounts): the session half of the portal auth - an
// opaque 256-bit bearer token handed to the browser as the portal_session
// cookie, while the database only ever stores its SHA-256 hash, so a leaked
// DB or log cannot masquerade as someone's session. Pure functions, matching
// the password.ts discipline.

export const PORTAL_SESSION_COOKIE = 'portal_session';
export const PORTAL_SESSION_TTL_DAYS = 30;
export const PORTAL_SESSION_TTL_MS = PORTAL_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface PortalSessionToken {
  /** The bearer value set on the cookie - shown to nothing, stored nowhere. */
  raw: string;
  /** SHA-256 of the raw token - the only thing the database stores. */
  tokenHash: string;
}

export function createPortalSessionToken(): PortalSessionToken {
  const raw = randomBytes(32).toString('base64url');
  return { raw, tokenHash: hashPortalSessionToken(raw) };
}

export function hashPortalSessionToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}