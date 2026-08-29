'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { deleteAccountAction, updateBrandingAction } from './actions';
import { accentCardClass, cardClass, primaryButtonClass, inputClass, labelClass } from '@/lib/ui/formStyles';

// FOUNDER MODEL W6 (de-pro, 2026-08-29): there is no self-serve plan any
// more - every account is the paid account, billed invoice-led via
// /dashboard/families (families.page generates the branded statement PDF),
// never through a card or a checkout in this UI. The old Upgrade/Cancel
// Flutterwave flow and the SaaS receipts card lived here and were removed
// with the freemium model; cancelSubscriptionAction and /api/billing/
// checkout remain dormant server-side for the future SaaS sale.
export default function SettingsPanel({
  role,
  brandName,
  brandAccent,
}: {
  role: string | null;
  brandName: string;
  brandAccent: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [nameValue, setNameValue] = useState(brandName);
  const [accentValue, setAccentValue] = useState(brandAccent);
  const [error, setError] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false);
  const router = useRouter();

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
      <div className={accentCardClass}>
        <h2 className="text-lg font-semibold text-[#1A1A18] mb-1">Your brand</h2>
        <p className="text-sm text-[#5C5849] mb-4">
          Your name appears as the wordmark across the dashboard, worksheets, session briefs, and invoices.
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
        <p className="text-sm text-[#5C5849]">
          Your account is on the founder&apos;s plan, billed at one inclusive monthly price per family. The app issues a
          branded invoice each month; there is nothing to manage or pay here.
        </p>
        {role === 'tutor' && (
          <Link
            href="/dashboard/families"
            className="text-sm text-[#1A3D2E] font-medium underline mt-3 inline-block"
          >
            View families and invoices
          </Link>
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