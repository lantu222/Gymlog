/**
 * Which weekdays the calendar marks as training days.
 *
 * Home marked `setupAvailableDays` — the days the reader said they COULD
 * train. A one-session-a-week programme therefore lit three dots, and the week
 * strip claimed three workouts where the plan prescribes one. Availability is
 * not a plan: the plan says how many sessions the week holds, availability says
 * which days are open.
 *
 * So the count comes from the plan and the placement from availability, spread
 * as evenly as the open days allow — two sessions across five open days land
 * apart rather than back to back.
 */

export function resolveProgramTrainingDays(
  availableDayIndexes: readonly number[],
  sessionsPerWeek: number,
): number[] {
  const open = [...new Set(availableDayIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index <= 6)
    .sort((left, right) => left - right);

  if (open.length === 0 || sessionsPerWeek <= 0) {
    // No answer rather than an invented rhythm: the strip shows no training
    // dots, which is what it did before any of this existed.
    return [];
  }
  if (sessionsPerWeek >= open.length) {
    return open;
  }

  // Even spread across the open days, first day always included.
  const picked: number[] = [];
  const stride = open.length / sessionsPerWeek;
  for (let i = 0; i < sessionsPerWeek; i += 1) {
    const index = Math.min(open.length - 1, Math.round(i * stride));
    const day = open[index];
    if (!picked.includes(day)) {
      picked.push(day);
    }
  }

  // Rounding can collide on tight ranges; fill from the remaining open days so
  // the count always matches what the plan prescribes.
  for (const day of open) {
    if (picked.length >= sessionsPerWeek) {
      break;
    }
    if (!picked.includes(day)) {
      picked.push(day);
    }
  }

  return picked.sort((left, right) => left - right);
}

/** Monday-first index per stored weekday key. */
export const WEEKDAY_INDEX: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
};
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/**
 * Which session each training day holds, as the programme page's week strip
 * prints it.
 *
 * The plan answers this: each entry pins a weekday to a session by id. The
 * strip paired the days with the programme's sessions by position instead,
 * which is the same answer only while every day has something in it. A day
 * with no exercises never reaches the plan, so once one was dragged above a
 * trained day the strip put it on Monday while Home trained the next one there
 * (backfill review of #33, 2026-09-16).
 *
 * Without usable plan ids — no plan yet, an entry that stands for the whole
 * template, or a rhythm still being edited — the days take the sessions that
 * have exercises, in the programme's order, which is how adoption deals them.
 */
export function sessionsOnTrainingDays<S extends { id: string; exerciseCount: number }>(
  days: readonly number[],
  planSessionIds: readonly (string | null | undefined)[] | null | undefined,
  sessions: readonly S[],
): Map<number, S> {
  const fromPlan =
    planSessionIds && planSessionIds.length === days.length
      ? planSessionIds.map((id) => (id ? sessions.find((session) => session.id === id) : undefined))
      : null;
  const dealt = fromPlan && fromPlan.every(Boolean)
    ? (fromPlan as S[])
    : sessions.filter((session) => session.exerciseCount > 0);
  const byDay = new Map<number, S>();
  days.forEach((day, order) => {
    const session = dealt[order];
    if (session) {
      byDay.set(day, session);
    }
  });
  return byDay;
}

/**
 * The weekdays a plan's own entries name, when they name weekdays at all.
 *
 * Entry labels are written from `setupAvailableDays`, so an adopted plan
 * already records which days it runs — but a plan built before that, or the
 * demo's "Day 1", labels its entries by position. Those return nothing rather
 * than a guess, and the caller falls back to deriving placement.
 *
 * ENTRY ORDER IS THE ANSWER, not Monday-first order. This used to sort, and
 * the sort silently threw away which session owns which day: the schedule
 * built from this list answers "which session is today" with the day's
 * POSITION in it (`trainingSchedule.sessionSlotOn`), so a plan whose sessions
 * run sun/wed/fri was read back as wed/fri/sun and Sunday became session
 * three. That is how a programme adopted on a Sunday could offer session one
 * in the hero and print "WED" on that very session's row (device walkthrough,
 * 2026-08-30). Every other caller either sorts for itself or asks `includes`,
 * so order costs them nothing.
 */
export function planWeekdayIndexes(entries: ReadonlyArray<{ label?: string | null }>): number[] {
  const indexes: number[] = [];
  for (const entry of entries) {
    const index = WEEKDAY_INDEX[(entry.label ?? '').trim().toLowerCase()];
    if (index === undefined) {
      return [];
    }
    if (!indexes.includes(index)) {
      indexes.push(index);
    }
  }
  return indexes;
}
