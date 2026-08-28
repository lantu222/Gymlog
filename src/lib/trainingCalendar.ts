import type { WorkoutSession } from '../types/models';
import { getCalendarWeekStartBefore } from './completedSessions';

/**
 * The weekly training streak.
 *
 * This file once built a whole month grid for a standalone calendar screen;
 * that screen was retired as a duplicate of Progress → Activity (2026-08-25),
 * and the streak is the one thing the activity section still asks for.
 */

function dayStartOf(iso: string): number | null {
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) {
    return null;
  }
  const date = new Date(stamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
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
  // Calendar stepping, not 7 * DAY. The week a clock changes is 167 or 169
  // hours long, so a fixed step lands at 23:00 or 01:00 and matches no entry in
  // trainedWeeks, which holds local Monday midnights. Twelve unbroken weeks
  // then render as one on the Monday after the clocks move.
  let cursor = trainedWeeks.has(thisMonday) ? thisMonday : getCalendarWeekStartBefore(thisMonday);
  let streak = 0;
  while (trainedWeeks.has(cursor)) {
    streak += 1;
    cursor = getCalendarWeekStartBefore(cursor);
  }
  return streak;
}

function mondayOf(date: Date): number {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay() is Sunday-first; the app's weeks start on Monday everywhere else.
  const offset = start.getDay() === 0 ? 6 : start.getDay() - 1;
  start.setDate(start.getDate() - offset);
  return start.getTime();
}
