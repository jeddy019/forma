'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cancelSubscriptionAction, deleteAccountAction, updateBrandingAction } from './actions';
import { accentCardClass, cardClass, primaryButtonClass, secondaryButtonClass, inputClass, labelClass } from '@/lib/ui/formStyles';

const PLAN_LABELS: Record<string, { name: string; price: string }> = {
  tutor: { name: 'Tutor', price: '$15/month' },
  parent: { name: 'Parent', price: '$10/month' },
};

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  plan: string;
  created_at: string;
}

function formatInvoiceAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function SettingsPanel({
  role,
  isPro,
  planExpiresAt,
  paymentNotice,
  invoices,
  brandName,
  brandAccent,
}: {
  role: string | null;
  isPro: boolean;
  planExpiresAt: string | null;
  paymentNotice: 'success' | 'failed' | null;
  invoices: InvoiceRow[];
  brandName: string;
  brandAccent: string;
}) {
  const router = useRouter();
  const [upgrading, setUpgrading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [nameValue, setNameValue] = useState(brandName);
  const [accentValue, setAccentValue] = useState(brandAccent);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);

  const planInfo = role ? PLAN_LABELS[role] : null;

  async function handleSaveBrand() {
    setSavingBrand(true);
    setError(null);
    setBrandSaved(false);
    const result = await updateBrandingAction({ name: nameValue, accent: accentValue });
    setSavingBrand(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBrandSaved(true);
    router.refresh();
  }

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

      <div className={accentCardClass}>
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-1">Your brand</h2>
        <p className="text-sm text-[#5C5849] mb-4">
          Your name appears as the wordmark across the dashboard, worksheets, and invoices.
        </p>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="brand-name" className={labelClass}>
              Brand name
            </label>
            <input
              id="brand-name"
              type="text"
              value={nameValue}
              onChange={(e) => {
                setNameValue(e.target.value);
                setBrandSaved(false);
              }}
              placeholder="e.g. Aisha Ade Tutoring"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div className="md:w-36">
            <label htmlFor="brand-accent" className={labelClass}>
              Accent
            </label>
            <div className="flex gap-2 items-center">
              <input
                id="brand-accent"
                type="color"
                value={accentValue}
                onChange={(e) => {
                  setAccentValue(e.target.value.toUpperCase());
                  setBrandSaved(false);
                }}
                className="h-[50px] w-12 rounded-[10px] border border-[#E0D9D0] bg-white cursor-pointer"
                aria-label="Accent colour"
              />
              <input
                type="text"
                value={accentValue}
                onChange={(e) => {
                  setAccentValue(e.target.value);
                  setBrandSaved(false);
                }}
                placeholder="#1A3D2E"
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSaveBrand}
          disabled={savingBrand}
          className={`${primaryButtonClass} mt-5 self-start`}
        >
          {savingBrand ? 'Saving...' : 'Save brand'}
        </button>
        {brandSaved && <p className="text-sm text-[#1A3D2E] mt-3">Brand saved.</p>}
      </div>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-3">Billing</h2>
        {isPro ? (
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
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-3">Billing history</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-[#9A9080] italic">No invoices yet - one appears here after your first payment.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[#E0D9D0]">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col">
                  <span className="text-sm text-[#1A1A18] font-medium">
                    {PLAN_LABELS[invoice.plan]?.name ?? invoice.plan} plan
                  </span>
                  <span className="text-xs text-[#9A9080]">
                    {new Date(invoice.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#1A1A18]">{formatInvoiceAmount(invoice.amount, invoice.currency)}</span>
                  <a
                    href={`/api/invoices/${invoice.id}/pdf`}
                    className="text-sm text-[#1A3D2E] font-medium underline"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
