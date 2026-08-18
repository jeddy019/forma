'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

// Phase 6 Step 36: "Optional student login... if the student has an email
// on file" (Legal Requirements). Deliberately magic-link only, not a
// password account like tutor/parent auth (src/app/login) - every student
// on this platform is a minor (Legal Requirements), and this is framed
// throughout CLAUDE.md as optional/lightweight, not a real signup flow -
// there's no separate "create an account" step, entering an email either
// creates or signs into the same auth user (shouldCreateUser: true),
// which is exactly the "optional, no friction" model the spec describes.
export default function StudentLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/student`, shouldCreateUser: true },
    });

    setLoading(false);
    if (otpError) {
      setError('Could not send a login link - please try again.');
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="block text-2xl font-semibold mb-1 text-center text-[#1A3D2E]" style={{ fontFamily: 'var(--font-playfair)' }}>
          Forma
        </Link>
        <p className="text-sm text-center mb-8 text-[#5C5849]">View your worksheet history.</p>

        {sent ? (
          <div className={`${cardClass} text-center animate-fade-up`}>
            <Mail className="w-6 h-6 text-[#1A3D2E] mx-auto mb-2" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm text-[#1A3D2E]">Check your email for a link to view your worksheets.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4`}>
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                placeholder="The email your tutor or parent has on file"
              />
            </div>

            {error && <p className="text-sm text-[#C0392B]">{error}</p>}

            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? 'Sending...' : 'Send login link'}
            </button>
          </form>
        )}
        <p className="text-xs text-center mt-4 text-[#9A9080]">
          Are you a tutor or parent?{' '}
          <Link href="/login" className="text-[#5C5849] font-medium underline">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
