import Link from 'next/link';
import StudentLoginForm from './StudentLoginForm';

// W8 Wave B: the student login page. Server component shell around the form -
// the brand here is deliberately neutral ("Forma"), because this screen is
// pre-identity: a student can reach it without knowing who runs the portal,
// so no individual owner brand can be shown yet (the /student portal itself
// is owner-branded once the account resolves).
export default function StudentLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="w-full max-w-sm animate-fade-up">
        <p className="text-2xl font-semibold mb-1 text-center text-[#1A3D2E]" style={{ fontFamily: 'var(--font-fira)' }}>
          Forma
        </p>
        <p className="text-sm text-center mb-8 text-[#5C5849]">Your practice portal - see your history and progress.</p>

        <StudentLoginForm />

        <p className="text-xs text-center mt-6 text-[#9A9080]">
          Lost your username or password?{' '}
          <span className="text-[#5C5849] font-medium">Your tutor can look it up.</span>
        </p>

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