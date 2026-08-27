import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass } from '@/lib/ui/formStyles';
import { isActivePro } from '@/lib/payments/planStatus';
import { PageHeader } from '@/lib/ui/PageHeader';
import MasteryBars from '@/lib/ui/MasteryBars';
import { toMasteryBars, masteryScore } from '@/lib/mastery/masteryView';
import type { SkillMap } from '@/lib/mastery/types';
import { ArrowLeft, UserRound } from 'lucide-react';

interface StudentRow {
  id: string;
  name: string;
  curriculum_level: string | null;
  year_level: string | null;
  skill_map: SkillMap | null;
}

export default async function MasteryStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: ownerRow } = await supabase.from('users').select('role, plan, plan_expires_at').eq('id', user.id).single();
  if (!ownerRow || ownerRow.role !== 'tutor' || !isActivePro(ownerRow.plan, ownerRow.plan_expires_at)) {
    redirect('/dashboard/mastery');
  }

  const { data: student } = await supabase
    .from('student_profiles')
    .select('id, name, curriculum_level, year_level, skill_map')
    .eq('id', studentId)
    .maybeSingle()
    .returns<StudentRow | null>();

  if (!student) notFound();

  const bars = toMasteryBars(student.skill_map);
  const overall = masteryScore(bars);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/dashboard/mastery"
        className="flex items-center gap-1.5 text-sm text-[#5C5849] hover:text-[#1A1A18] transition-colors duration-micro ease-premium"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        Back to class mastery
      </Link>

      <PageHeader
        icon={UserRound}
        title={student.name}
        subtitle={`${student.curriculum_level ?? '—'}${student.year_level ? ` - ${student.year_level}` : ''}`}
      />

      <div className={`${cardClass} flex flex-col gap-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1A1A18]">Sub-skill mastery</h2>
          {overall != null && (
            <span className="text-sm text-[#5C5849]">
              Average <span className="font-medium text-[#1A1A18]">{overall}%</span>
            </span>
          )}
        </div>
        <MasteryBars bars={bars} />
      </div>
    </div>
  );
}
