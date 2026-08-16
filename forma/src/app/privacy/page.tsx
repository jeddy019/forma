// Stub page - just enough for the signup page's required privacy notice
// link (Legal Requirements: DATA AND MINORS) to point somewhere real. Not a
// full privacy policy.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4EF' }}>
      <div className="max-w-xl text-center">
        <h1 className="text-xl font-semibold mb-4 text-[#1A3D2E]">Privacy notice</h1>
        <p className="text-sm text-[#5C5849] leading-relaxed">
          Forma stores the information needed to generate and mark practice worksheets, including
          student profiles and submitted answers. Inactive accounts and student data are deleted
          after 24 months, and you can request deletion at any time from your account settings.
        </p>
      </div>
    </div>
  );
}
