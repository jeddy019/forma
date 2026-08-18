import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/lib/ui/EmptyState';
import { interactiveCardClass } from '@/lib/ui/formStyles';
import { Users } from 'lucide-react';
import StudentForm from './StudentForm';

// Performance Rule 3: paginate all lists, never load an unbounded one.
const PAGE_SIZE = 20;

interface StudentRow {
  id: string;
  name: string;
  curriculum_level: string | null;
  year_level: string | null;
  subjects: string[] | null;
}

export default async function StudentsPage({
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
    data: students,
    count,
    error,
  } = await supabase
    .from('student_profiles')
    // Performance Rule 2: never SELECT *.
    .select('id, name, curriculum_level, year_level, subjects', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<StudentRow[]>();

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Students</h1>
        <p className="text-sm text-[#5C5849]">Add a student, then generate practice built for them.</p>
      </div>

      <StudentForm />

      <div className="flex flex-col gap-3">
        {error && <p className="text-sm text-[#C0392B]">Could not load students - please refresh.</p>}
        {!error && students?.length === 0 && (
          <EmptyState icon={Users} message="No students yet - add your first one above." />
        )}
        {students?.map((student) => (
          <Link
            key={student.id}
            href={`/dashboard/students/${student.id}`}
            className={`${interactiveCardClass} p-4 flex items-center justify-between gap-4`}
          >
            <div>
              <p className="text-sm font-medium text-[#1A1A18]">{student.name}</p>
              <p className="text-xs text-[#9A9080]">
                {student.curriculum_level} - {student.year_level}
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end max-w-[50%]">
              {(student.subjects ?? []).map((subject) => (
                <span key={subject} className="text-xs bg-[#E8F2ED] text-[#1A3D2E] rounded-full px-2.5 py-1">
                  {subject}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-[#5C5849]">
          {page > 1 && (
            <a href={`/dashboard/students?page=${page - 1}`} className="text-[#1A3D2E] font-medium">
              Previous
            </a>
          )}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/dashboard/students?page=${page + 1}`} className="text-[#1A3D2E] font-medium">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
