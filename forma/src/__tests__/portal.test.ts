import { describe, expect, it } from 'vitest';
import {
  generatePortalPassword,
  generatePortalUsername,
  hashPortalPassword,
  verifyPortalPassword,
} from '@/lib/portal/password';
import {
  createPortalSessionToken,
  hashPortalSessionToken,
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_TTL_DAYS,
} from '@/lib/portal/session';

describe('portal password hashing', () => {
  it('round-trips a correct password', () => {
    const stored = hashPortalPassword('vqrm-x3m9');
    expect(verifyPortalPassword('vqrm-x3m9', stored)).toBe(true);
    expect(stored).toMatch(/^scrypt\$\d+,\d+,\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  });

  it('rejects a wrong password', () => {
    const stored = hashPortalPassword('vqrm-x3m9');
    expect(verifyPortalPassword('vqrm-x3m8', stored)).toBe(false);
  });

  it('salts - two hashes of the same password differ', () => {
    expect(hashPortalPassword('vqrm-x3m9')).not.toBe(hashPortalPassword('vqrm-x3m9'));
  });

  it('returns false for a malformed stored value instead of throwing', () => {
    expect(verifyPortalPassword('vqrm-x3m9', 'not-a-valid-string')).toBe(false);
    expect(verifyPortalPassword('vqrm-x3m9', 'scrypt$bad$salt$hash')).toBe(false);
  });

  it('generates a usable 8-char dashed password and signs in against it', () => {
    const password = generatePortalPassword();
    expect(password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(generatePortalPassword()).not.toBe(password);
    expect(verifyPortalPassword(password, hashPortalPassword(password))).toBe(true);
  });
});

describe('portal username generation', () => {
  it('derives from the first word of the name, lowercased', () => {
    expect(generatePortalUsername('Aisha Ade')).toMatch(/^aisha-[bcdfghjkmnpqrstvwxz]{4}$/);
    expect(generatePortalUsername('Jedidiah')).toMatch(/^jedidiah-[bcdfghjkmnpqrstvwxz]{4}$/);
  });

  it('strips non-alphanumerics and falls back to "student"', () => {
    expect(generatePortalUsername("O'Brien-Kane")).toMatch(/^obrienkane-[bcdfghjkmnpqrstvwxz]{4}$/);
    expect(generatePortalUsername('   ')).toMatch(/^student-[bcdfghjkmnpqrstvwxz]{4}$/);
  });

  it('produces varied suffixes', () => {
    const suffixes = new Set(Array.from({ length: 20 }, () => generatePortalUsername('Aisha').split('-')[1]));
    expect(suffixes.size).toBeGreaterThan(3);
  });
});

describe('portal session tokens', () => {
  it('creates a raw token that never equals its stored hash', () => {
    const { raw, tokenHash } = createPortalSessionToken();
    expect(raw).toHaveLength(43);
    expect(tokenHash).toHaveLength(64);
    expect(raw).not.toBe(tokenHash);
  });

  it('hashes deterministically and uniquely', () => {
    expect(hashPortalSessionToken('abc')).toBe(hashPortalSessionToken('abc'));
    expect(hashPortalSessionToken('abc')).not.toBe(hashPortalSessionToken('abd'));
  });

  it('exposes stable session constants', () => {
    expect(PORTAL_SESSION_COOKIE).toBe('portal_session');
    expect(PORTAL_SESSION_TTL_DAYS).toBe(30);
  });
});