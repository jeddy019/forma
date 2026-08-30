import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';

// W8 Wave B (portal accounts): password hashing/derivation for the generated
// portal credentials, using node:crypto's built-in scrypt - no new
// dependency, and scrypt is memory-hard (the right shape for a credential a
// founder types to a family, not an email-bound auth token). Pure functions,
// unit-tested: the DB layer (portal_accounts) is deny-all RLS and only the
// admin client paths ever call them.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_FORMAT = 'scrypt';

// No ambiguous characters: no i/l/o/0/1, no vowels needed in the username
// suffix so it can't accidentally spell a word, and no look-alike pairs.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const USERNAME_SUFFIX_ALPHABET = 'bcdfghjkmnpqrstvwxz';

function randomChars(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

export function hashPortalPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  const key = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('base64url');
  return `${SCRYPT_FORMAT}$${SCRYPT_N},${SCRYPT_R},${SCRYPT_P}$${salt}$${key}`;
}

export function verifyPortalPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== SCRYPT_FORMAT) return false;
  const [n, r, p] = parts[1].split(',').map(Number);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p) || n <= 0 || r <= 0 || p <= 0) return false;
  try {
    const expected = Buffer.from(parts[3], 'base64url');
    const actual = scryptSync(password, parts[2], expected.length, { N: n, r, p });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// A generated password a founder can read out over the phone: 8 chars in an
// unambiguous alphabet, dashed into two halves (e.g. "vqrm-x3m9").
export function generatePortalPassword(): string {
  return `${randomChars(PASSWORD_ALPHABET, 4)}-${randomChars(PASSWORD_ALPHABET, 4)}`;
}

// Username derived from the student's name so the founder can spot it: the
// first word lowercased/alphanumeric plus a 4-char consonant suffix so it is
// not trivially guessable (e.g. "aisha-kxqr"). Uniqueness is enforced by the
// DB index on LOWER(username); the caller re-derives on a collision.
export function generatePortalUsername(name: string): string {
  const base = (name.trim().split(/\s+/)[0] ?? 'student').toLowerCase().replace(/[^a-z0-9]/g, '') || 'student';
  return `${base}-${randomChars(USERNAME_SUFFIX_ALPHABET, 4)}`;
}