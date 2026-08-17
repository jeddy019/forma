import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/admin/isAdminEmail';
import { cardClass } from '@/lib/ui/formStyles';
import QuestionForm from './QuestionForm';
import QuestionRowActions from './QuestionRowActions';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface QuestionBankRow {
  id: string;
  country: string;
  curriculum_level: string;
  subject: string;
  topic: string;
  sub_skill: string | null;
  question_json: { text: string; marks: number } | null;
  verified_by: string | null;
  verified_at: string | null;
}

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Not a /dashboard route (proxy.ts's middleware doesn't cover /admin) -
  // this page is its own primary auth gate, same reasoning as the student
  // portal's own /student page.
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

  // question_bank's own RLS is deny-all to anon/authenticated (schema.sql) -
  // the admin/service-role client is required here regardless of the
  // isAdminEmail check above, which only gates the page itself.
  const admin = createAdminClient();
  const {
    data: questions,
    count,
    error,
  } = await admin
    .from('question_bank')
    .select('id, country, curriculum_level, subject, topic, sub_skill, question_json, verified_by, verified_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<QuestionBankRow[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F7F4EF' }}>
      <main className="px-6 py-8 max-w-3xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Question bank</h1>
          <p className="text-sm text-[#5C5849]">
            Phase 7 Step 42 - human-verified questions, submitted or reviewed by educators. Not yet wired into
            generation (that half of Step 42 needs the Anthropic account back).
          </p>
        </div>

        <QuestionForm />

        <div className="flex flex-col gap-3">
          {error && <p className="text-sm text-[#C0392B]">Could not load questions - please refresh.</p>}
          {!error && questions?.length === 0 && <p className="text-sm text-[#9A9080] italic">No questions submitted yet.</p>}
          {questions?.map((q) => (
            <div key={q.id} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">
                  {q.subject} - {q.topic}
                  {q.sub_skill && ` (${q.sub_skill})`}
                </p>
                <p className="text-xs text-[#9A9080] mt-1">
                  {q.country} - {q.curriculum_level} - {q.question_json?.marks ?? '?'} mark
                  {q.question_json?.marks === 1 ? '' : 's'}
                </p>
                {q.question_json?.text && <p className="text-xs text-[#5C5849] mt-2 max-w-lg">{q.question_json.text}</p>}
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 inline-block mt-2 ${
                    q.verified_by ? 'bg-[#E8F2ED] text-[#1A3D2E]' : 'bg-[#FEF9EC] text-[#B8963C]'
                  }`}
                >
                  {q.verified_by ? `Verified by ${q.verified_by}` : 'Unverified'}
                </span>
              </div>
              <QuestionRowActions id={q.id} verified={Boolean(q.verified_by)} />
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
            {page > 1 && (
              <a href={`/admin/question-bank?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
                Previous
              </a>
            )}
            <span>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a href={`/admin/question-bank?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
                Next
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
