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

// hasFixedWeekdays / resolveSessionWeekday are gone (2026-08-25): they read
// the plan's STORED weekday labels, which a switch to a training cycle leaves
// untouched — so the Home rows kept saying MON/THU under a six-day rotation.
// The rows now ask trainingSchedule.upcomingSessionDayStarts, the same source
// every calendar lights its dots from.
