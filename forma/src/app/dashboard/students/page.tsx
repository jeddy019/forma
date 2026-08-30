import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/lib/ui/EmptyState';
import { PageHeader } from '@/lib/ui/PageHeader';
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

interface FamilyMemberRow {
  student_id: string;
  family: { name: string } | null;
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

  // W8 Wave E (family-first): the parent email lives on the family, so the
  // student list groups under family headings ("Needs a family" for the rest)
  // rather than implying each student row is its own billing/email unit.
  // student_id is UNIQUE on family_members, so each student has at most one
  // family - no fan-out when building the group maps below.
  const studentIds = (students ?? []).map((student) => student.id);
  const { data: memberRows } = studentIds.length
    ? await supabase
        .from('family_members')
        .select('student_id, family:families(name)')
        .in('student_id', studentIds)
        .returns<FamilyMemberRow[]>()
    : { data: [] };

  const familyNameByStudentId = new Map<string, string>();
  for (const row of memberRows ?? []) {
    if (row.family?.name) familyNameByStudentId.set(row.student_id, row.family.name);
  }

  const grouped = new Map<string, StudentRow[]>();
  const needsFamily: StudentRow[] = [];
  for (const student of students ?? []) {
    const familyName = familyNameByStudentId.get(student.id);
    if (familyName) {
      const list = grouped.get(familyName) ?? [];
      list.push(student);
      grouped.set(familyName, list);
    } else {
      needsFamily.push(student);
    }
  }

  const totalPages = count ? Math.max(1, Math.ceil(count / PAGE_SIZE)) : 1;

  function StudentCard({ student }: { student: StudentRow }) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader icon={Users} title="Students" subtitle="Add a student, then generate practice built for them." />

      <StudentForm />

      <div className="flex flex-col gap-6">
        {error && <p className="text-sm text-[#C0392B]">Could not load students - please refresh.</p>}
        {!error && students?.length === 0 && (
          <EmptyState icon={Users} message="No students yet - add your first one above." />
        )}

        {[...grouped.keys()].map((familyName) => (
          <div key={familyName} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[#1A3D2E]">{familyName}</h2>
            <div className="flex flex-col gap-3">
              {(grouped.get(familyName) ?? []).map((student) => (
                <StudentCard key={student.id} student={student} />
              ))}
            </div>
          </div>
        ))}

        {needsFamily.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-[#9A9080]">Needs a family</h2>
            <div className="flex flex-col gap-3">
              {needsFamily.map((student) => (
                <StudentCard key={student.id} student={student} />
              ))}
            </div>
          </div>
        )}
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