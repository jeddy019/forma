'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';
import { sendWelcomeEmailAction } from './actions';

const REGIONS = [
  { value: 'england', label: 'England' },
  { value: 'canada_ontario', label: 'Canada (Ontario)' },
  { value: 'united_states', label: 'United States' },
] as const;

type Region = (typeof REGIONS)[number]['value'];

function isRole(value: string | null): value is 'tutor' | 'parent' {
  return value === 'tutor' || value === 'parent';
}

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The landing page's "For tutors" / "For parents" links pass ?role=,
  // pre-selecting the right option here rather than making a visitor who
  // already told us which they are re-declare it - the same audience-first
  // pattern Maths Genie and Dr Frost's "I'm a parent" / "For Teachers"
  // entry points use, wired to something real rather than just labels.
  const roleParam = searchParams.get('role');
  const [role, setRole] = useState<'tutor' | 'parent'>(isRole(roleParam) ? roleParam : 'tutor');
  const [region, setRegion] = useState<Region>('england');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const supabase = createClient();
    // role/region ride on user_metadata rather than being inserted into the
    // users table directly here - signUp() does not guarantee an active
    // session (email confirmation may be required), and the users row needs
    // an authenticated caller for RLS. See ensureUserProfile.ts, which reads
    // this metadata back once a session actually exists.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, region } },
    });

    setLoading(false);

    if (signUpError) {
      setError('Could not create an account - please try again.');
      return;
    }

    // EMAIL 1: sent immediately on signup, regardless of whether email
    // confirmation is pending - never awaited/blocking, and the action
    // itself never throws (see send.tsx), so this can't affect the signup
    // flow either way.
    void sendWelcomeEmailAction(email, role);

    if (!data.session) {
      setNotice('Check your email to confirm your account before signing in.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="block text-2xl font-semibold mb-1 text-center text-[#1A3D2E]" style={{ fontFamily: 'var(--font-playfair)' }}>
          Forma
        </Link>
        <p className="text-sm text-center mb-8 text-[#5C5849]">Practice built for your student.</p>

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
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="role">
              I am a
            </label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as 'tutor' | 'parent')}
              className={inputClass}
            >
              <option value="tutor">Tutor</option>
              <option value="parent">Parent</option>
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="region">
              Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(event) => setRegion(event.target.value as Region)}
              className={inputClass}
            >
              {REGIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-[#C0392B]">{error}</p>}
          {notice && <p className="text-sm text-[#1A3D2E]">{notice}</p>}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-xs text-center mt-4 text-[#9A9080]">
          By creating an account you agree to our{' '}
          <Link href="/privacy" className="underline">
            privacy notice
          </Link>
          .
        </p>

        <p className="text-sm text-center mt-6 text-[#5C5849]">
          Already have an account?{' '}
          <Link href="/login" className="text-[#1A3D2E] font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
