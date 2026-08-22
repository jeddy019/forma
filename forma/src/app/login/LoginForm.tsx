'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { inputClass, labelClass, primaryButtonClass, cardClass } from '@/lib/ui/formStyles';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError('Incorrect email or password. Please try again.');
      return;
    }

    const redirectTo = searchParams.get('redirect') || '/dashboard';
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <Link href="/" className="block text-2xl font-semibold mb-1 text-center text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-[#C0392B]">{error}</p>}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        <p className="text-sm text-center mt-6 text-[#5C5849]">
          New to Forma?{' '}
          <Link href="/signup" className="text-[#1A3D2E] font-medium">
            Create an account
          </Link>
        </p>
        <p className="text-xs text-center mt-3 text-[#9A9080]">
          Are you a student?{' '}
          <Link href="/student/login" className="text-[#5C5849] font-medium underline">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
