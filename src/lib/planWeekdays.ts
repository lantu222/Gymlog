import { I18nKey, t } from './i18n';
import type { AppLanguage } from '../types/models';

/**
 * Which weekday a plan's session sits on — and when the honest answer is "we
 * do not know".
 *
 * This lived inside ProgramsHomeScreen until the active-program block moved to
 * Home. Copying it would have given the two screens their own opinion about the
 * same week, which is exactly the bug it was written to fix: the Programs tab
 * once showed MON/WED/FRI for a plan while Home and Progress showed nothing,
 * because those two refuse to invent a rhythm and that one did it happily.
 * One source, one answer.
 */

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Same spread pattern as ProgramDetailScreen's schedule preview. */
const TRAINING_DAY_SPREAD: Record<number, number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 3, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

const WEEKDAY_SET = new Set(WEEKDAYS);

// The three-letter codes are matched against saved plan entries, so they stay
// English; only what the chip shows is translated.
const WEEKDAY_DISPLAY_KEYS: Record<string, I18nKey> = {
  MON: 'setup.day.mon',
  TUE: 'setup.day.tue',
  WED: 'setup.day.wed',
  THU: 'setup.day.thu',
  FRI: 'setup.day.fri',
  SAT: 'setup.day.sat',
  SUN: 'setup.day.sun',
};

/**
 * A generic Mon/Wed/Fri-style spread, only ever used to fill a GAP in a plan
 * that does carry fixed weekdays. It never invents a whole week.
 */
function weekdayForSession(index: number, sessionCount: number) {
  const spread = TRAINING_DAY_SPREAD[Math.min(6, Math.max(1, sessionCount))] ?? [0, 2, 4];
  return WEEKDAYS[spread[index] ?? Math.min(index, 6)];
}

/**
 * The plan's own weekday vocabulary for a date, Monday first.
 *
 * Home's TODAY badge asked the rotation instead of the calendar — the variable
 * was named `isToday` and meant "is next", so the badge sat on whichever row
 * came next whatever day it was, and was right only by coincidence.
 */
export function weekdayCodeForDate(date: Date): string {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

export function weekdayLabel(code: string, language: AppLanguage) {
  const key = WEEKDAY_DISPLAY_KEYS[code];
  return (key ? t(language, key) : code).toUpperCase();
}

/** True when at least one session in the week names a real weekday. */
export function hasFixedWeekdays(sessions: readonly { dayLabel?: string | null }[]): boolean {
  return sessions.some((entry) => WEEKDAY_SET.has(entry.dayLabel?.trim().slice(0, 3).toUpperCase() ?? ''));
}

/**
 * The weekday for one session, or null when the plan has no schedule at all.
 *
 * Null is a real answer, not a failure: with nothing scheduled the row draws no
 * badge rather than a made-up day or a session number the title already states.
 */
export function resolveSessionWeekday(
  dayLabel: string | null | undefined,
  index: number,
  sessionCount: number,
  anyFixedWeekday: boolean,
): string | null {
  const normalized = dayLabel?.trim().slice(0, 3).toUpperCase() ?? '';
  if (WEEKDAY_SET.has(normalized)) {
    return normalized;
  }
  return anyFixedWeekday ? weekdayForSession(index, sessionCount) : null;
}
