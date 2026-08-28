import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/admin/isAdminEmail';
import { cardClass } from '@/lib/ui/formStyles';
import ImportForm from './ImportForm';
import { ChevronLeft } from 'lucide-react';

export default async function QuestionBankImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  if (!isAdminEmail(user.email, process.env.ADMIN_EMAILS)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: '#F7F4EF' }}>
        <div className={`${cardClass} max-w-md text-center`}>
          <p className="text-sm text-[#5C5849]">Not authorized.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <main className="px-6 py-8 max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <Link
            href="/admin/question-bank"
            className="inline-flex items-center gap-1 text-sm text-[#5C5849] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
          >
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
            Question bank
          </Link>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1 mt-1">Bulk import</h1>
          <p className="text-sm text-[#5C5849]">
            Phase B Wave 4 Step 69 - import an array of educator-verified questions from the extraction pipeline. Rows are
            validated, deduplicated against the bank by question text, and inserted already marked verified.
          </p>
        </div>

        <ImportForm />
      </main>
    </div>
  );
}