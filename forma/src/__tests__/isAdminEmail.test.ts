import { describe, expect, it } from 'vitest';
import { isAdminEmail } from '@/lib/admin/isAdminEmail';

describe('isAdminEmail', () => {
  it('is false when the env var is unset', () => {
    expect(isAdminEmail('founder@forma.app', undefined)).toBe(false);
  });

  it('is false when the email is null/undefined', () => {
    expect(isAdminEmail(null, 'founder@forma.app')).toBe(false);
    expect(isAdminEmail(undefined, 'founder@forma.app')).toBe(false);
  });

  it('matches a single email in the allowlist', () => {
    expect(isAdminEmail('founder@forma.app', 'founder@forma.app')).toBe(true);
  });

  it('matches one of several comma-separated emails, ignoring surrounding whitespace', () => {
    expect(isAdminEmail('teacher@example.com', 'founder@forma.app, teacher@example.com , other@example.com')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isAdminEmail('Founder@Forma.App', 'founder@forma.app')).toBe(true);
  });

  it('rejects an email not on the list', () => {
    expect(isAdminEmail('random@example.com', 'founder@forma.app')).toBe(false);
  });
});
