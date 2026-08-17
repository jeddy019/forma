import { describe, expect, it } from 'vitest';
import { encodeTxRef, decodeTxRef } from '@/lib/payments/txRef';

describe('txRef', () => {
  it('round-trips a UUID user id and plan key', () => {
    const userId = '4274fa7f-c101-4601-aa83-25bb136edd77';
    const encoded = encodeTxRef(userId, 'tutor');
    expect(decodeTxRef(encoded)).toEqual({ userId, planKey: 'tutor' });
  });

  it('round-trips the parent plan key', () => {
    const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const encoded = encodeTxRef(userId, 'parent');
    expect(decodeTxRef(encoded)).toEqual({ userId, planKey: 'parent' });
  });

  it('rejects a malformed tx_ref', () => {
    expect(decodeTxRef('not-a-real-ref')).toBeNull();
    expect(decodeTxRef('forma_onlytwoparts')).toBeNull();
    expect(decodeTxRef('wrongprefix_userid_tutor_12345')).toBeNull();
  });

  it('rejects an unrecognised plan key', () => {
    expect(decodeTxRef('forma_userid_student_12345')).toBeNull();
  });
});
