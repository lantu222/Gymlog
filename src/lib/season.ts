import { ProgramSeason } from './programSeasons';

/**
 * A season as a fixed window, not a filter.
 *
 * The browse tab treated seasons as a way to narrow the catalog. This is the
 * other thing they can be: a dated, shared block that starts, runs for 26
 * weeks and closes — 1.4.–30.9. and 1.10.–31.3., the same two dates for
 * everyone, every year. That is what makes "week 9 / 26" and "18 weeks left"
 * mean something, and it is why the season screen can count down at all.
 *
 * The boundary is the same one `getSeasonForDate` already uses, so a program
 * filed under winter and the winter season window can never disagree.
 *
 * Everything here is calendar arithmetic. Nothing in this file needs a server,
 * an account, or another human being.
 */

export const SEASON_WEEKS = 26;

/** The four blocks a season is trained in. */
export const SEASON_BLOCK_COUNT = 4;

export interface SeasonWindow {
  season: ProgramSeason;
  /** Inclusive start, local midnight. */
  start: Date;
  /** Exclusive end — the first day of the next season. */
  end: Date;
  /** Calendar year the season is named after (its START year). */
  year: number;
}

function midnight(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

/**
 * The season window containing `date`.
 *
 * Winter straddles the new year, so its window starts in the previous calendar
 * year whenever the date is in January–March. Getting that wrong would put
 * someone in week 40 of a 26-week season every February.
 */
export function resolveSeasonWindow(date: Date = new Date()): SeasonWindow {
  const year = date.getFullYear();
  const month = date.getMonth();

  if (month >= 3 && month <= 8) {
    // 1 April – 30 September
    return { season: 'summer', start: midnight(year, 3, 1), end: midnight(year, 9, 1), year };
  }
  if (month >= 9) {
    // 1 October – 31 December, running into next year
    return { season: 'winter', start: midnight(year, 9, 1), end: midnight(year + 1, 3, 1), year };
  }
  // January – March: still the winter season that opened last October.
  return { season: 'winter', start: midnight(year - 1, 9, 1), end: midnight(year, 3, 1), year: year - 1 };
}

/** The window that opens when the current one closes. */
export function nextSeasonWindow(date: Date = new Date()): SeasonWindow {
  const current = resolveSeasonWindow(date);
  // One day past the end lands inside the next window by construction.
  return resolveSeasonWindow(new Date(current.end.getTime() + 86_400_000));
}

const DAY = 86_400_000;

/**
 * Which week of the season `date` falls in, 1-based and clamped.
 *
 * Clamped because a season is 26 weeks by definition and the calendar half is
 * a day or two longer or shorter depending on the months — a screen that says
 * "week 27 / 26" is worse than one that holds at 26 for the last two days.
 */
export function seasonWeek(window: SeasonWindow, date: Date = new Date()): number {
  const elapsed = date.getTime() - window.start.getTime();
  if (elapsed < 0) {
    return 0;
  }
  return Math.min(SEASON_WEEKS, Math.floor(elapsed / (7 * DAY)) + 1);
}

/** Whole weeks left, floored, never negative. */
export function seasonWeeksLeft(window: SeasonWindow, date: Date = new Date()): number {
  return Math.max(0, SEASON_WEEKS - seasonWeek(window, date));
}

/** 0..1 for the progress bar. */
export function seasonProgressRatio(window: SeasonWindow, date: Date = new Date()): number {
  const week = seasonWeek(window, date);
  return Math.max(0, Math.min(1, week / SEASON_WEEKS));
}

export type SeasonBlockKey = 'base' | 'load' | 'power' | 'peak';

export const SEASON_BLOCKS: readonly SeasonBlockKey[] = ['base', 'load', 'power', 'peak'];

/**
 * Which of the four blocks a week sits in, 0-based.
 *
 * 26 does not divide by 4, so the blocks are 7/6/7/6 rather than a fractional
 * split — a block boundary lands on a Monday or it is not a block boundary.
 */
export function seasonBlockIndex(week: number): number {
  const clamped = Math.max(1, Math.min(SEASON_WEEKS, week));
  if (clamped <= 7) return 0;
  if (clamped <= 13) return 1;
  if (clamped <= 20) return 2;
  return 3;
}

/** True while `date` sits inside the window. */
export function isSeasonActive(window: SeasonWindow, date: Date = new Date()): boolean {
  return date.getTime() >= window.start.getTime() && date.getTime() < window.end.getTime();
}
