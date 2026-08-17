'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SUBJECTS, DIFFICULTY_LEVELS, DELIVERY_TIMEZONES, type Subject, type DifficultyLevel, type DeliveryTimezone } from '@/lib/constants';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOPIC_MAX_LENGTH = 200;
const MAX_TOPICS = 10;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ScheduleActionResult {
  error?: string;
  // Explicit true (not just "no error") so ScheduleCard can tell a fresh
  // useActionState's initial {} apart from an actual successful save, and
  // close its own edit mode only on the latter.
  success?: boolean;
}

async function requirePro(): Promise<{ error?: string; userId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You must be signed in.' };

  // FREE tier: "No automation" (Permissions Summary) - applies to both
  // tutor and parent roles alike, unlike the marking dashboard's
  // tutor-only gate.
  const { data: ownerRow } = await supabase.from('users').select('plan').eq('id', user.id).single();
  if (!ownerRow || ownerRow.plan !== 'pro') {
    return { error: 'Automated schedules are available on a paid plan.' };
  }
  return { userId: user.id };
}

function parseTopics(formData: FormData): string[] | null {
  const raw = String(formData.get('topics') ?? '');
  const topics = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (topics.length > MAX_TOPICS || topics.some((t) => t.length > TOPIC_MAX_LENGTH)) return null;
  return topics;
}

function parseScheduleFields(formData: FormData) {
  const studentId = String(formData.get('studentId') ?? '');
  const subject = String(formData.get('subject') ?? '');
  const difficulty = String(formData.get('difficulty') ?? 'standard');
  const dayOfWeek = Number(formData.get('dayOfWeek'));
  const deliveryHour = Number(formData.get('deliveryHour'));
  const deliveryTimezone = String(formData.get('deliveryTimezone') ?? 'Europe/London');
  const topics = parseTopics(formData);

  if (!UUID_PATTERN.test(studentId)) return { error: 'Please select a student.' } as const;
  if (!SUBJECTS.includes(subject as Subject)) return { error: 'Please select a valid subject.' } as const;
  if (!DIFFICULTY_LEVELS.includes(difficulty as DifficultyLevel)) return { error: 'Please select a valid difficulty.' } as const;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return { error: 'Please select a valid day.' } as const;
  if (!Number.isInteger(deliveryHour) || deliveryHour < 0 || deliveryHour > 23) return { error: 'Please select a valid time.' } as const;
  if (!DELIVERY_TIMEZONES.includes(deliveryTimezone as DeliveryTimezone)) return { error: 'Please select a valid timezone.' } as const;
  if (topics === null) return { error: `Please enter ${MAX_TOPICS} topics or fewer, each under ${TOPIC_MAX_LENGTH} characters.` } as const;

  return {
    studentId,
    subject: subject as Subject,
    difficulty: difficulty as DifficultyLevel,
    dayOfWeek,
    deliveryHour,
    deliveryTimezone: deliveryTimezone as DeliveryTimezone,
    topics,
  } as const;
}

export async function createScheduleAction(
  _prevState: ScheduleActionResult,
  formData: FormData
): Promise<ScheduleActionResult> {
  const { error: authError, userId } = await requirePro();
  if (authError || !userId) return { error: authError };

  const fields = parseScheduleFields(formData);
  if ('error' in fields) return { error: fields.error };

  const supabase = await createClient();
  const { error: insertError } = await supabase.from('schedules').insert({
    owner_id: userId,
    student_id: fields.studentId,
    subject: fields.subject,
    topics: fields.topics,
    difficulty: fields.difficulty,
    day_of_week: fields.dayOfWeek,
    delivery_hour: fields.deliveryHour,
    delivery_timezone: fields.deliveryTimezone,
  });

  if (insertError) {
    console.error('Failed to create schedule', insertError);
    return { error: 'Could not save this schedule - please try again.' };
  }

  revalidatePath('/dashboard/schedule');
  return { success: true };
}

export async function updateScheduleAction(
  _prevState: ScheduleActionResult,
  formData: FormData
): Promise<ScheduleActionResult> {
  const { error: authError } = await requirePro();
  if (authError) return { error: authError };

  const scheduleId = String(formData.get('scheduleId') ?? '');
  if (!UUID_PATTERN.test(scheduleId)) return { error: 'Invalid schedule.' };

  const fields = parseScheduleFields(formData);
  if ('error' in fields) return { error: fields.error };

  const supabase = await createClient();
  // RLS (schedules_own, auth.uid() = owner_id) is the real ownership check -
  // a schedule belonging to another user simply matches zero rows here.
  const { error: updateError } = await supabase
    .from('schedules')
    .update({
      student_id: fields.studentId,
      subject: fields.subject,
      topics: fields.topics,
      difficulty: fields.difficulty,
      day_of_week: fields.dayOfWeek,
      delivery_hour: fields.deliveryHour,
      delivery_timezone: fields.deliveryTimezone,
    })
    .eq('id', scheduleId);

  if (updateError) {
    console.error('Failed to update schedule', updateError);
    return { error: 'Could not save changes - please try again.' };
  }

  revalidatePath('/dashboard/schedule');
  return { success: true };
}

// "Pause until [date]" (User Challenges) sets paused_until and leaves
// is_paused false - the Automated Schedule Logic's own query
// (is_paused = false AND (paused_until IS NULL OR paused_until < NOW()))
// then naturally resumes it once that date passes, no user action needed.
// Leaving the date blank pauses indefinitely (is_paused = true) instead -
// that one needs an explicit "Resume now" to come back.
export async function pauseScheduleAction(formData: FormData): Promise<void> {
  const { error: authError } = await requirePro();
  if (authError) return;

  const scheduleId = String(formData.get('scheduleId') ?? '');
  if (!UUID_PATTERN.test(scheduleId)) return;

  const untilDate = String(formData.get('pausedUntil') ?? '').trim();
  const supabase = await createClient();

  if (untilDate) {
    if (!DATE_PATTERN.test(untilDate)) return;
    await supabase.from('schedules').update({ is_paused: false, paused_until: untilDate }).eq('id', scheduleId);
  } else {
    await supabase.from('schedules').update({ is_paused: true, paused_until: null }).eq('id', scheduleId);
  }

  revalidatePath('/dashboard/schedule');
}

export async function resumeScheduleAction(formData: FormData): Promise<void> {
  const { error: authError } = await requirePro();
  if (authError) return;

  const scheduleId = String(formData.get('scheduleId') ?? '');
  if (!UUID_PATTERN.test(scheduleId)) return;

  const supabase = await createClient();
  await supabase.from('schedules').update({ is_paused: false, paused_until: null }).eq('id', scheduleId);
  revalidatePath('/dashboard/schedule');
}

export async function deleteScheduleAction(formData: FormData): Promise<void> {
  const { error: authError } = await requirePro();
  if (authError) return;

  const scheduleId = String(formData.get('scheduleId') ?? '');
  if (!UUID_PATTERN.test(scheduleId)) return;

  const supabase = await createClient();
  await supabase.from('schedules').delete().eq('id', scheduleId);
  revalidatePath('/dashboard/schedule');
}
