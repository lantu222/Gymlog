import { SetupWeekday } from '../types/models';

/**
 * What a square in the activity calendar means.
 *
 * `missed` is only ever claimed about a day that has already passed and was
 * genuinely a planned training day. A rest day without a session is just rest,
 * and a training day still ahead is upcoming, not a failure — the calendar
 * should never invent a streak the user broke.
 */
export type ProgressActivityDayStatus = 'done' | 'missed' | 'upcoming' | 'rest' | 'outside';

export interface ProgressActivityDayInput {
  dayStart: number;
  dayNumber: number;
  active: boolean;
  isToday: boolean;
  inCurrentMonth: boolean;
}

export interface ProgressActivityOptions {
  /** Weekdays the plan schedules; empty means the plan has no fixed days. */
  trainingDays?: SetupWeekday[];
  /** Start-of-day timestamp for today, used to place a day in past or future. */
  todayStart?: number;
}

const WEEKDAY_BY_INDEX: SetupWeekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function getProgressActivityDayStatus(
  day: ProgressActivityDayInput,
  options: ProgressActivityOptions = {},
): ProgressActivityDayStatus {
  if (!day.inCurrentMonth) {
    return 'outside';
  }

  if (day.active) {
    return 'done';
  }

  const planned = options.trainingDays ?? [];
  if (planned.length === 0) {
    // Without a schedule there is nothing to have missed.
    return 'rest';
  }

  const weekday = WEEKDAY_BY_INDEX[new Date(day.dayStart).getDay()];
  if (!planned.includes(weekday)) {
    return 'rest';
  }

  const todayStart = options.todayStart;
  if (todayStart === undefined) {
    return 'rest';
  }

  // Today stays in play until it ends, so it reads as upcoming, never missed.
  return day.dayStart < todayStart ? 'missed' : 'upcoming';
}
