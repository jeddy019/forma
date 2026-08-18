import { redirect } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import GenerateForm from './GenerateForm';
import { EmptyState } from '@/lib/ui/EmptyState';
import { isActivePro } from '@/lib/payments/planStatus';

interface StudentOption {
  id: string;
  name: string;
}

interface TemplateOption {
  id: string;
  name: string;
  notes: string | null;
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

  // Permissions Summary lists "mark scheme PDF", "group mode", and
  // "templates" as the same tutor-pro entitlement - one shared condition,
  // named props per call site for clarity at each usage.
  const isTutorPro = ownerRow?.role === 'tutor' && isActivePro(ownerRow?.plan, ownerRow?.plan_expires_at);
  const canDownloadMarkScheme = isTutorPro;
  const canUseGroupMode = isTutorPro;

  // Same capped-picker pattern as students above - only fetched for
  // tutor-pro accounts, since templates are gated the same way.
  const { data: templates } = isTutorPro
    ? await supabase.from('templates').select('id, name, notes').order('name').limit(200)
    : { data: [] };

  if (!students || students.length === 0) {
    return (
      <div className="flex flex-col gap-6 max-w-xl">
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Generate a worksheet</h1>
          <p className="text-sm text-[#5C5849]">Describe the struggle. Forma builds the practice.</p>
        </div>
        <EmptyState
          icon={UserPlus}
          message="Add a student first, then come back here to generate practice for them."
          actionLabel="Add a student"
          actionHref="/dashboard/students"
        />
      </div>
    );
  }

  return (
    <GenerateForm
      students={students as StudentOption[]}
      canDownloadMarkScheme={canDownloadMarkScheme}
      canUseGroupMode={canUseGroupMode}
      templates={(templates ?? []) as TemplateOption[]}
    />
  );
}
