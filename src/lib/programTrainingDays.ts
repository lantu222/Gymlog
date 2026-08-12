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
 * The weekdays a plan's own entries name, when they name weekdays at all.
 *
 * Entry labels are written from `setupAvailableDays`, so an adopted plan
 * already records which days it runs — but a plan built before that, or the
 * demo's "Day 1", labels its entries by position. Those return nothing rather
 * than a guess, and the caller falls back to deriving placement.
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
  return indexes.sort((left, right) => left - right);
}
