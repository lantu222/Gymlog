import { getHomeMonthCalendar, HomeMonthCalendarDay } from './homeCalendar';
import type { AppLanguage, WorkoutSession } from '../types/models';

/**
 * The training month, and the streak behind it.
 *
 * The grid itself comes from `getHomeMonthCalendar` rather than a second
 * implementation: Home already draws a month, and two calendars in one app
 * disagree about the first Monday exactly once and then nobody can reproduce
 * it. This adds the only thing that layer is missing — which days were
 * trained — plus the summary and the streak underneath it.
 */

const DAY = 86_400_000;

function dayStartOf(iso: string): number | null {
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) {
    return null;
  }
  const date = new Date(stamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export interface TrainingCalendarDay extends HomeMonthCalendarDay {
  /** Sessions logged that day, in the order they were performed. */
  sessionIds: string[];
}

export interface TrainingCalendar {
  monthLabel: string;
  weekdayLabels: string[];
  weeks: TrainingCalendarDay[][];
  /** The month being shown, for the summary and for paging. */
  year: number;
  month: number;
}

/**
 * A month with its logged sessions marked.
 *
 * `monthOffset` pages backwards and forwards; only `isToday` stays anchored to
 * the real date, so a paged month never claims a day is today.
 */
export function buildTrainingCalendar(
  sessions: readonly WorkoutSession[],
  options: { now?: Date; language?: AppLanguage; monthOffset?: number } = {},
): TrainingCalendar {
  const { now = new Date(), language = 'en', monthOffset = 0 } = options;
  const base = getHomeMonthCalendar(now, language, monthOffset);

  const byDay = new Map<number, string[]>();
  for (const session of sessions) {
    const day = dayStartOf(session.performedAt);
    if (day === null) {
      continue;
    }
    const list = byDay.get(day);
    if (list) {
      list.push(session.id);
    } else {
      byDay.set(day, [session.id]);
    }
  }

  const shifted = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);

  return {
    monthLabel: base.monthLabel,
    weekdayLabels: base.weekdayLabels,
    year: shifted.getFullYear(),
    month: shifted.getMonth(),
    weeks: base.weeks.map((week) =>
      week.map((day) => ({
        ...day,
        // Days from the neighbouring months are drawn as padding, so marking
        // them trained would put a purple square outside the month it belongs
        // to and double-count it when the reader pages there.
        sessionIds: day.inMonth ? (byDay.get(day.dayStart) ?? []) : [],
      })),
    ),
  };
}

export interface TrainingMonthSummary {
  sessions: number;
  volumeKg: number;
  /** Mean session length, rounded; null when no session recorded one. */
  averageMinutes: number | null;
}

/** What the month came to, from the sessions inside it. */
export function summarizeTrainingMonth(
  sessions: readonly WorkoutSession[],
  year: number,
  month: number,
): TrainingMonthSummary {
  const inMonth = sessions.filter((session) => {
    const stamp = Date.parse(session.performedAt);
    if (!Number.isFinite(stamp)) {
      return false;
    }
    const date = new Date(stamp);
    return date.getFullYear() === year && date.getMonth() === month;
  });

  const durations = inMonth
    .map((session) => session.durationMinutes)
    .filter((minutes): minutes is number => typeof minutes === 'number' && minutes > 0);

  return {
    sessions: inMonth.length,
    volumeKg: inMonth.reduce((total, session) => total + (session.totalVolumeKg ?? 0), 0),
    averageMinutes:
      durations.length > 0
        ? Math.round(durations.reduce((total, minutes) => total + minutes, 0) / durations.length)
        : null,
  };
}

/**
 * Consecutive weeks with at least one session, counting back from this one.
 *
 * The CURRENT week never breaks the streak when it is empty — it is not over
 * yet, and a counter that resets every Monday morning is a counter nobody
 * trusts. It only counts once it has a session in it.
 */
export function weeklyTrainingStreak(
  sessions: readonly WorkoutSession[],
  now: Date = new Date(),
): number {
  const trainedWeeks = new Set<number>();
  for (const session of sessions) {
    const day = dayStartOf(session.performedAt);
    if (day !== null) {
      trainedWeeks.add(mondayOf(new Date(day)));
    }
  }
  if (trainedWeeks.size === 0) {
    return 0;
  }

  const thisMonday = mondayOf(now);
  let cursor = trainedWeeks.has(thisMonday) ? thisMonday : thisMonday - 7 * DAY;
  let streak = 0;
  while (trainedWeeks.has(cursor)) {
    streak += 1;
    cursor -= 7 * DAY;
  }
  return streak;
}

function mondayOf(date: Date): number {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() is Sunday-first; the app's weeks start on Monday everywhere else.
  const offset = start.getDay() === 0 ? 6 : start.getDay() - 1;
  return start.getTime() - offset * DAY;
}
