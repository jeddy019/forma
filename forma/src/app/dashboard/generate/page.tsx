import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import GenerateForm from './GenerateForm';
import { cardClass, secondaryButtonClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';

interface StudentOption {
  id: string;
  name: string;
}

export default async function GeneratePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: students }, { data: ownerRow }] = await Promise.all([
    // Not the paginated "History" pattern from /dashboard/students - this is
    // a picker, not a browsable list - but still capped rather than truly
    // unbounded, per Performance Rule 3.
    supabase.from('student_profiles').select('id, name').order('name').limit(200),
    supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single(),
  ]);

  // Permissions Summary lists both "mark scheme PDF" and "group mode" as
  // the same tutor-pro entitlement - one shared condition, two named props
  // per call site for clarity at each usage.
  const isTutorPro = ownerRow?.role === 'tutor' && isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at);
  const canDownloadMarkScheme = isTutorPro;
  const canUseGroupMode = isTutorPro;

  if (!students || students.length === 0) {
    return (
      <div className={`${cardClass} text-center flex flex-col items-center gap-4`}>
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Generate a worksheet</h1>
          <p className="text-sm text-[#5C5849]">Add a student first, then come back here to generate practice for them.</p>
        </div>
        <Link href="/dashboard/students" className={secondaryButtonClass}>
          Add a student
        </Link>
      </div>
    );
  }

  return (
    <GenerateForm
      students={students as StudentOption[]}
      canDownloadMarkScheme={canDownloadMarkScheme}
      canUseGroupMode={canUseGroupMode}
    />
  );
}
