import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { PageHeader } from '@/lib/ui/PageHeader';
import HeatMapGrid from '@/lib/ui/HeatMapGrid';
import { buildHeatMap } from '@/lib/mastery/masteryView';
import type { SkillMap } from '@/lib/mastery/types';
import { BarChart3 } from 'lucide-react';

// B6: the tutor's whole-class mastery view. Unlike the scrollable lists,
// this page intentionally loads the full class in one aggregate grid - the
// point is to see everyone at once. Bounded by the plan caps (up to 30
// students in Basic, unlimited in Pro), never an unbounded query.
const MAX_STUDENTS = 100;

interface StudentRow {
  id: string;
  name: string;
  skill_map: SkillMap | null;
}

export default async function MasteryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Permissions Summary: mastery is a tutor-pro entitlement (Basic/Pro).
  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader icon={BarChart3} title="Mastery" subtitle="Class-wide progress across your students." />
        <div className={`${cardClass} text-center`}>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Class mastery</h1>
          <p className="text-sm text-[#5C5849]">This view is available on the Tutor plan.</p>
        </div>
      </div>
    );
  }

  const { data: students, error } = await supabase
    .from('student_profiles')
    // Performance Rule 2: explicit columns only.
    .select('id, name, skill_map')
    .order('created_at', { ascending: false })
    .range(0, MAX_STUDENTS - 1)
    .returns<StudentRow[]>();

  const heatMap = buildHeatMap(
    (students ?? []).map((s) => ({ id: s.id, name: s.name, skillMap: s.skill_map }))
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        icon={BarChart3}
        title="Mastery"
        subtitle="Colour-coded class progress - green is secure, red needs work."
      />

      {error ? (
        <p className="text-sm text-[#C0392B]">Could not load mastery data - please refresh.</p>
      ) : (
        <HeatMapGrid heatMap={heatMap} />
      )}

      {(students ?? []).length === 0 && !error && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm italic text-[#9A9080]">No students yet.</p>
          <Link href="/dashboard/students" className="text-sm text-[#1A3D2E] font-medium hover:underline">
            Add your first student
          </Link>
        </div>
      )}
    </div>
  );
}
