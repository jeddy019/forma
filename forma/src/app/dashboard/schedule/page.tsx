import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { cardClass, secondaryButtonClass } from '@/lib/ui/formStyles';
import ScheduleForm from './ScheduleForm';
import ScheduleCard, { type ScheduleRow } from './ScheduleCard';

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // FREE tier: "No automation" (Permissions Summary) - applies to both
  // tutor and parent roles, unlike the marking dashboard's tutor-only gate.
  const { data: ownerRow } = await supabase.from('users').select('plan').eq('id', user.id).single();
  if (!ownerRow || ownerRow.plan !== 'pro') {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Automated practice</h1>
        <p className="text-sm text-[#5C5849]">Automated schedules are available on a paid plan.</p>
      </div>
    );
  }

  const [{ data: students }, { data: schedules }] = await Promise.all([
    // Not the paginated "History" pattern - a picker, not a browsable list -
    // but still capped rather than truly unbounded, per Performance Rule 3.
    supabase.from('student_profiles').select('id, name').order('name').limit(200),
    supabase
      .from('schedules')
      .select(
        'id, student_id, subject, topics, difficulty, day_of_week, delivery_hour, delivery_timezone, is_paused, paused_until, last_generated_at, student:student_profiles(name)'
      )
      .order('created_at', { ascending: false })
      .limit(200)
      .returns<ScheduleRow[]>(),
  ]);

  if (!students || students.length === 0) {
    return (
      <div className={`${cardClass} text-center flex flex-col items-center gap-4`}>
        <div>
          <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Automated practice</h1>
          <p className="text-sm text-[#5C5849]">Add a student first, then set up a recurring schedule for them.</p>
        </div>
        <Link href="/dashboard/students" className={secondaryButtonClass}>
          Add a student
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-[#1A1A18] mb-1">Automated practice</h1>
        <p className="text-sm text-[#5C5849]">Deliver a worksheet automatically, every week.</p>
      </div>

      <ScheduleForm students={students} />

      <div className="flex flex-col gap-3">
        {(!schedules || schedules.length === 0) && (
          <p className="text-sm text-[#9A9080] italic">No schedules yet - create one above.</p>
        )}
        {schedules?.map((schedule) => (
          <ScheduleCard key={schedule.id} schedule={schedule} students={students} />
        ))}
      </div>
    </div>
  );
}
