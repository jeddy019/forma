'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { provisionPortalLoginAction, resetPortalLoginAction, type PortalCredentialResult } from './actions';
import { FormHeader } from '@/lib/ui/FormHeader';
import PortalCredentialBox from '@/lib/ui/PortalCredentialBox';
import { accentCardClass, primaryButtonClass } from '@/lib/ui/formStyles';

// W8 Wave B slice 2 (provisioning): the founder's control for a student's
// portal login. Credentials are generated here (issue when none exists, reset
// to mint a fresh password when lost) and shown ONCE on screen (shared
// PortalCredentialBox) - the database keeps only the scrypt hash, so after
// this card is dismissed no screen can retrieve the password again; the
// founder simply resets to get a new one. There is deliberately no self-serve
// "forgot password" for a minor's login.
export default function PortalLoginCard({
  studentId,
  studentName,
  account,
}: {
  studentId: string;
  studentName: string;
  account: { username: string | null; passwordResetAt: string | null } | null;
}) {
  const [creds, setCreds] = useState<{ username: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = studentName.split(' ')[0] || studentName;

  async function handle(action: 'issue' | 'reset') {
    setBusy(true);
    setError(null);
    const result: PortalCredentialResult =
      action === 'issue' ? await provisionPortalLoginAction(studentId) : await resetPortalLoginAction(studentId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCreds({ username: result.username as string, password: result.password as string });
  }

  const lastResetLabel = account?.passwordResetAt
    ? new Date(account.passwordResetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className={`${accentCardClass} flex flex-col gap-3`}>
      <FormHeader icon={KeyRound} title="Student portal login" />

      {creds ? (
        <PortalCredentialBox
          username={creds.username}
          password={creds.password}
          loginPath="/student/login"
          recipient={firstName}
          onReset={() => handle('reset')}
          onDone={() => setCreds(null)}
          busy={busy}
        />
      ) : (
        <>
          <p className="text-sm text-[#5C5849]">
            {account?.username
              ? `Login issued (username ${account.username}).${lastResetLabel ? ` Last reset ${lastResetLabel}.` : ''} Resetting mints a new password - the old one stops working immediately.`
              : `No portal login yet - generate a username and password so ${firstName} can see their own progress (no email needed).`}
          </p>
          <div className="flex flex-wrap gap-3">
            {account?.username ? (
              <button type="button" onClick={handle.bind(null, 'reset')} disabled={busy} className={primaryButtonClass}>
                {busy ? 'Working...' : 'Reset password'}
              </button>
            ) : (
              <button type="button" onClick={handle.bind(null, 'issue')} disabled={busy} className={primaryButtonClass}>
                {busy ? 'Working...' : 'Issue login'}
              </button>
            )}
          </div>
        </>
      )}

      {error && <p className="text-sm text-[#C0392B]">{error}</p>}
    </div>
  );
}