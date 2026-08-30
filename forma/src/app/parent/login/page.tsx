import Link from 'next/link';
import ParentLoginForm from './ParentLoginForm';

// W8 Wave B slice 2: the parent login page. Like /student/login, this screen
// is deliberately neutral ("Forma") because it is pre-identity - a parent
// reaches it before any account resolves, so no individual owner brand can be
// shown yet (the /parent portal itself is owner-branded once the account
// resolves). Stays on the warm cream surface, nothing interactive below the
// fold beyond the two ways back to the other audiences.
export default function ParentLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <p className="text-2xl font-semibold mb-1 text-center text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
          Forma
        </p>
        <p className="text-sm text-center mb-8 text-[#5C5849]">Your family&apos;s practice portal - progress at a glance.</p>

        <ParentLoginForm />

        <p className="text-xs text-center mt-6 text-[#9A9080]">
          Lost your username or password? <span className="text-[#5C5849] font-medium">Your tutor can look it up.</span>
        </p>

        <div className="flex flex-col gap-1 text-xs text-center mt-4 text-[#9A9080]">
          <span>
            Is your child practising?{' '}
            <Link href="/student/login" className="text-[#5C5849] font-medium underline">
              Student login here
            </Link>
          </span>
          <span>
            Are you a tutor?{' '}
            <Link href="/login" className="text-[#5C5849] font-medium underline">
              Log in here
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}