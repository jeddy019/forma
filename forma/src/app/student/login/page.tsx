'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

// Phase 6 Step 36: "Optional student login... if the student has an email on
// file" (Legal Requirements). Two ways in:
//   1. Magic link (default) - passwordless, one-time code, the lightweight
//      model the spec describes for minor students.
//   2. Password - a plain email+password login, so a student (or their
//      tutor/parent setting them up) who prefers not to wait for an email can
//      sign straight in. Both end in the same /student portal.
export default function StudentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'link' | 'password'>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (mode === 'link') {
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
      return;
    }

    const { error: passwordError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (passwordError) {
      setError('Incorrect email or password. Please try again.');
      return;
    }
    router.push('/student');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="block text-2xl font-semibold mb-1 text-center text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
          Forma
        </Link>
        <p className="text-sm text-center mb-8 text-[#5C5849]">View your worksheet history and progress.</p>

        {mode === 'link' && sent ? (
          <div className={`${cardClass} text-center animate-fade-up`}>
            <Mail className="w-6 h-6 text-[#1A3D2E] mx-auto mb-2" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm text-[#1A3D2E]">Check {email} for a link to view your worksheets.</p>
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

            {mode === 'password' && (
              <div>
                <label className={labelClass} htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </div>
            )}

            {error && <p className="text-sm text-[#C0392B]">{error}</p>}

            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? 'Please wait...' : mode === 'password' ? 'Log in' : 'Send login link'}
            </button>

            <button
              type="button"
              onClick={() => setMode(mode === 'link' ? 'password' : 'link')}
              className="flex items-center justify-center gap-1.5 text-sm text-[#5C5849] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
            >
              {mode === 'password' ? <Mail className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" /> : <KeyRound className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
              {mode === 'password' ? 'Instead, email me a link' : 'Or log in with a password'}
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
