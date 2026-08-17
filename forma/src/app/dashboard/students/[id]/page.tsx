import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import SessionNotesForm from './SessionNotesForm';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface StudentRow {
  id: string;
  name: string;
  curriculum_level: string | null;
  year_level: string | null;
  subjects: string[] | null;
}

interface SessionNoteRow {
  id: string;
  content: string;
  created_at: string;
}

function formatNoteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id: studentId } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS (profiles_own: auth.uid() = owner_id) means this simply returns no
  // row if studentId belongs to a different tutor/parent - notFound() below
  // covers both "doesn't exist" and "isn't yours" without distinguishing them.
  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name, curriculum_level, year_level, subjects')
    .eq('id', studentId)
    .single<StudentRow>();

  if (!student) notFound();

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  const canUseSessionNotes = ownerRow?.role === 'tutor' && isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at);

  let notes: SessionNoteRow[] = [];
  let totalPages = 1;
  if (canUseSessionNotes) {
    const { data: noteRows, count } = await supabase
      .from('session_notes')
      .select('id, content, created_at', { count: 'exact' })
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<SessionNoteRow[]>();
    notes = noteRows ?? [];
    totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard/students" className="text-sm text-[#5C5849]">
          Students
        </Link>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1 mt-1">{student.name}</h1>
        <p className="text-sm text-[#5C5849]">
          {student.curriculum_level} - {student.year_level}
        </p>
      </div>

      {!canUseSessionNotes ? (
        <div className={`${cardClass} text-center`}>
          <h2 className="text-lg font-semibold text-[#1A1A18] mb-1">Session notes</h2>
          <p className="text-sm text-[#5C5849]">Session notes are available on the Tutor plan.</p>
        </div>
      ) : (
        <>
          <SessionNotesForm studentId={student.id} />

          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-[#1A1A18]">Past notes</h2>
            {notes.length === 0 && <p className="text-sm text-[#9A9080] italic">No session notes yet.</p>}
            {notes.map((note) => (
              <div key={note.id} className="bg-[#F0EBE3] border-[0.5px] border-[#E0D9D0] rounded-[12px] p-4">
                <p className="text-xs text-[#9A9080] mb-1.5">{formatNoteDate(note.created_at)}</p>
                <p className="text-sm text-[#1A1A18] whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
              {page > 1 && (
                <a href={`/dashboard/students/${studentId}?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
                  Previous
                </a>
              )}
              <span>
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <a href={`/dashboard/students/${studentId}?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
                  Next
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
