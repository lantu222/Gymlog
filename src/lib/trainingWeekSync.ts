/**
 * One training week, two stores.
 *
 * `preferences.setupAvailableDays` is availability — the days the reader said
 * they COULD train. A plan's `entries[].label` is the rhythm — the days the
 * programme actually runs. Adoption writes the rhythm from availability once
 * and the two have drifted apart ever since: the rhythm strip on the programme
 * screen moved Home and the calendar, the weekday picker in Profile moved
 * notifications and the widget, and neither moved the other. Both editors show
 * seven identical weekday chips, so the reader has no way to know which half of
 * the app they just changed.
 *
 * These two functions are the bridge. They are deliberately the only place the
 * mapping lives, and they are pure so the rules are testable without a store.
 *
 * Placement reuses `resolveProgramTrainingDays`, the same even spread the week
 * strip already derives with — two sessions across five open days land apart
 * rather than back to back, and picking days by hand gives the same answer as
 * letting the app derive them.
 */

import { DEFAULT_RHYTHM_BY_DAYS } from './firstRunSetup';
import { SetupWeekday } from '../types/models';
import { WEEKDAY_INDEX, WEEKDAY_KEYS, resolveProgramTrainingDays } from './programTrainingDays';

/** The weekdays a plan's entries name, Monday-first. Empty = they name none. */
export function weekdaysFromPlanLabels(
  entries: ReadonlyArray<{ label?: string | null }>,
): SetupWeekday[] {
  const days: SetupWeekday[] = [];
  for (const entry of entries) {
    const key = (entry.label ?? '').trim().toLowerCase();
    const index = WEEKDAY_INDEX[key];
    if (index === undefined) {
      // One unlabelled entry and the plan is positional ("Day 1"), not weekly.
      // Half an answer would be worse than none.
      return [];
    }
    if (!days.includes(key as SetupWeekday)) {
      days.push(key as SetupWeekday);
    }
  }
  return days.sort((left, right) => WEEKDAY_INDEX[left] - WEEKDAY_INDEX[right]);
}

/**
 * The labels a plan's entries should carry for a chosen set of available days,
 * one per entry in order.
 *
 * `null` means do not write. Fewer chosen days than the plan has sessions is
 * the case that matters: the sessions cannot be placed, and repeating a day to
 * make the count fit would hand the reader a week they never chose. The caller
 * stores the availability and leaves the rhythm alone.
 */
export function planLabelsFromWeekdays(
  entryCount: number,
  days: readonly SetupWeekday[],
): SetupWeekday[] | null {
  if (!Number.isInteger(entryCount) || entryCount <= 0) {
    return null;
  }

  const indexes = days
    .map((day) => WEEKDAY_INDEX[day])
    .filter((index): index is number => index !== undefined);
  const placed = resolveProgramTrainingDays(indexes, entryCount);

  if (placed.length !== entryCount) {
    return null;
  }

  return placed.map((index) => WEEKDAY_KEYS[index]);
}

/**
 * The weekdays a programme should run on when it is taken into use.
 *
 * Adoption used to read the reader's availability and nothing else, falling
 * back to a hardcoded three-day rhythm when the setup had never asked. The
 * plan then dealt sessions round-robin across those labels, so a six-session
 * programme got Mon/Wed/Fri twice and ran as a three-day programme. Every
 * programme became a three-day programme, whatever its own week said.
 *
 * The session count leads now. Availability places the days when it can hold
 * them; when it cannot — too few days chosen, or none — the programme's own
 * count picks the rhythm, because halving a programme silently is a worse
 * answer than starting it on days the reader can still move.
 */
export function planLabelsForProgramme(
  sessionCount: number,
  availableDays: readonly SetupWeekday[],
): SetupWeekday[] {
  const sessions = Math.max(1, Math.min(7, Math.round(sessionCount) || 1));
  const placed = planLabelsFromWeekdays(sessions, availableDays);
  if (placed) {
    return placed;
  }
  if (sessions === 1) {
    // One session: the reader's first open day, or Monday.
    return [availableDays[0] ?? 'mon'];
  }
  if (sessions === 7) {
    return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  }
  return [...DEFAULT_RHYTHM_BY_DAYS[sessions as 2 | 3 | 4 | 5 | 6]];
}
