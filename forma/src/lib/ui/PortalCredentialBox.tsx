'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { primaryButtonClass } from '@/lib/ui/formStyles';

// W8 Wave B slice 2: the one-time credential reveal shared by BOTH the
// student and parent portal-provisioning cards. Same-looking box, same
// clipboard behaviour, so the founder sees one consistent "here are the
// credentials" moment whether issuing a student or a parent login. The
// plaintext lives only in the action response passed in as props and is
// copied to the clipboard on demand - it is never stored or shown by any
// later screen.
export default function PortalCredentialBox({
  username,
  password,
  loginPath,
  recipient,
  onReset,
  onDone,
  busy,
}: {
  username: string;
  password: string;
  loginPath: string;
  recipient: string;
  onReset: () => void;
  onDone: () => void;
  busy: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${username}\n${password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission - the text is still selectable by hand.
    }
  }

  return (
    <div className="border border-[#C8A84B] bg-[#FEF9EC] rounded-[10px] p-4 flex flex-col gap-3 animate-fade-up">
      <p className="text-sm text-[#1A1A18]">
        These are shown once - write them down and pass them on to {recipient} now.
      </p>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-[#9A9080]">Username</p>
        <p className="font-mono text-base text-[#1A1A18]" data-testid="portal-username">
          {username}
        </p>
        <p className="text-xs text-[#9A9080] mt-1">Password</p>
        <p className="font-mono text-base text-[#1A1A18]" data-testid="portal-password">
          {password}
        </p>
      </div>
      <p className="text-xs text-[#9A9080]">
        They log in at {window.location.origin}
        {loginPath}. After this box is closed, only Reset can mint a new password.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onReset} disabled={busy} className={primaryButtonClass}>
          {busy ? 'Working...' : 'Reset password'}
        </button>
        <button type="button" onClick={copy} className={primaryButtonClass}>
          {copied ? (
            <>
              <Check className="w-4 h-4" strokeWidth={2} aria-hidden="true" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" strokeWidth={2} aria-hidden="true" /> Copy these
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded-[10px] text-sm text-[#5C5849] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
        >
          Got it - hide
        </button>
      </div>
    </div>
  );
}