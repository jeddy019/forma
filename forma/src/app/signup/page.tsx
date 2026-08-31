import Link from 'next/link';
import { primaryButtonClass, secondaryButtonClass } from '@/lib/ui/formStyles';

// FOUNDER MODEL W6 (de-pro, decided 2026-08-29): public self-serve signup is
// closed. Forma is the founder's own practice system running a small number
// of families at a time; there is no free tier and no self-serve plan to
// quote, so the old self-serve SignupForm is retired. New families come
// through the founder directly, and existing accounts keep logging in
// normally. (The student, parent, and founder login routes all stay live -
// /login, /student/login, /parent/login - just no self-serve registration.)
// If the SaaS sale ever reopens self-serve signup, a fresh SignupForm is
// rebuilt then; the old one was removed as dead code 2026-08-31.
export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#F7F4EF] px-6 py-16 flex items-center justify-center">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <span className="text-lg font-semibold text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
          Forma
        </span>
        <h1 className="text-2xl text-[#1A1A18] font-semibold leading-snug">
          Signup is closed for now.
        </h1>
        <p className="text-sm text-[#5C5849] leading-relaxed max-w-sm">
          Forma is built around a small number of students, each with practice designed specifically for them - so new
          places open one family at a time.
        </p>
        <p className="text-sm text-[#5C5849] leading-relaxed max-w-sm">
          If you&apos;re a parent of an existing student, your practice and reports are already set up on your side -
          nothing to sign up for.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link href="/login" className={primaryButtonClass}>
            Log in
          </Link>
          <Link href="/" className={secondaryButtonClass}>
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}