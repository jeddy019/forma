import { DAY_OF_WEEK_LABELS } from '@/lib/constants';

// Testing Strategy (CLAUDE.md) explicitly lists "cron schedule matching
// logic" under UNIT TESTS - extracted out of the cron route itself so it's
// importable and testable without spinning up a request/response cycle or
// hitting the database.
export interface DueCheckInput {
  dayOfWeek: number;
  deliveryHour: number;
  deliveryTimezone: string;
  lastGeneratedAt: string | null;
}

const DAYS_SINCE_LAST_GENERATION = 6;

export function isDueNow(schedule: DueCheckInput, now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: schedule.deliveryTimezone,
    weekday: 'long',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const dayIndex = (DAY_OF_WEEK_LABELS as readonly string[]).indexOf(weekday);

  if (dayIndex !== schedule.dayOfWeek) return false;
  if (hour !== schedule.deliveryHour) return false;

  if (schedule.lastGeneratedAt) {
    const daysSince = (now.getTime() - new Date(schedule.lastGeneratedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < DAYS_SINCE_LAST_GENERATION) return false;
  }

  return true;
}
