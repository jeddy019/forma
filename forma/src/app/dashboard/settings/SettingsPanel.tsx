'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cancelSubscriptionAction, deleteAccountAction } from './actions';
import { cardClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui/formStyles';

const PLAN_LABELS: Record<string, { name: string; price: string }> = {
  tutor: { name: 'Tutor', price: '$15/month' },
  parent: { name: 'Parent', price: '$10/month' },
};

export default function SettingsPanel({
  role,
  plan,
  planExpiresAt,
  paymentNotice,
}: {
  role: string | null;
  plan: string;
  planExpiresAt: string | null;
  paymentNotice: 'success' | 'failed' | null;
}) {
  const router = useRouter();
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const planInfo = role ? PLAN_LABELS[role] : null;

  async function handleUpgrade() {
    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.link) {
        setError(data.error ?? 'Could not start checkout - please try again.');
        setUpgrading(false);
        return;
      }
      window.location.href = data.link;
    } catch {
      setError('Connection lost. Please try again.');
      setUpgrading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancel your subscription? You will lose access to paid features immediately.')) return;
    setCancelling(true);
    setError(null);
    const result = await cancelSubscriptionAction();
    setCancelling(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setCancelled(true);
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Delete your account and all data? This cannot be undone.')) return;
    if (!window.confirm('This is permanent. All students, worksheets, and submissions will be deleted. Continue?')) return;
    setDeleting(true);
    setError(null);
    const result = await deleteAccountAction();
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      return;
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="flex flex-col gap-6">
      {paymentNotice === 'success' && (
        <p className="text-sm text-[#1A3D2E] bg-[#E8F2ED] rounded-[10px] px-4 py-3">Payment confirmed - your plan is now active.</p>
      )}
      {paymentNotice === 'failed' && (
        <p className="text-sm text-[#C0392B] bg-[#FDEDEC] rounded-[10px] px-4 py-3">
          Payment could not be confirmed. Please try again or contact support.
        </p>
      )}

      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-3">Billing</h2>
        {plan === 'pro' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#5C5849]">
              You are on the {planInfo?.name ?? ''} plan ({planInfo?.price ?? ''}).
              {planExpiresAt && ` Renews ${new Date(planExpiresAt).toLocaleDateString('en-GB')}.`}
            </p>
            {cancelled ? (
              <p className="text-sm text-[#1A3D2E]">Subscription cancelled.</p>
            ) : (
              <button type="button" onClick={handleCancel} disabled={cancelling} className={`${secondaryButtonClass} self-start`}>
                {cancelling ? 'Cancelling...' : 'Cancel subscription'}
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#5C5849]">
              You are on the free plan (3 worksheets a month). Upgrade to {planInfo?.name ?? 'a paid plan'} for{' '}
              {planInfo?.price ?? 'unlimited worksheets'}.
            </p>
            <button type="button" onClick={handleUpgrade} disabled={upgrading} className={`${primaryButtonClass} self-start`}>
              {upgrading ? 'Starting checkout...' : `Upgrade - ${planInfo?.price ?? ''}`}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[#C0392B]">{error}</p>}

      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-2">Delete account</h2>
        <p className="text-sm text-[#5C5849] mb-3">
          Permanently deletes your account and all associated students, worksheets, and submissions. This cannot be
          undone.
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="text-sm text-[#C0392B] font-medium"
        >
          {deleting ? 'Deleting...' : 'Delete my account and all data'}
        </button>
      </div>
    </div>
  );
}
