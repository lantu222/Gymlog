import { WorkoutSession } from '../types/models';
import { SeasonWindow, SEASON_WEEKS, seasonWeek } from './season';

/**
 * Season points, from the reader's own logged work.
 *
 * The design's season screen is built on a leaderboard: 1 480 people, rank
 * 412, "+38 places a week". None of that can exist on a device that only knows
 * what one person did, and this app has already refused to ship invented
 * social proof once (see programTrendingDemo). So the ranking waits for a
 * server — and everything else here does not.
 *
 * Points, badges, the weekly requirement and the end-of-season report are all
 * computed from the user's own sessions. That is most of the screen, and it is
 * the half that is true whether or not anyone else ever joins.
 *
 * The scoring RULE is chosen rather than measured, which is fine — a game's
 * rules are allowed to be decided — but the screen states the rule next to the
 * number so a reader can check the arithmetic themselves.
 */

export const POINTS_PER_WORKOUT = 10;
export const POINTS_PER_FULL_WEEK = 25;

export interface SeasonWeekSummary {
  /** 1-based week of the season. */
  week: number;
  workouts: number;
  /** True when the week met the program's days-per-week target. */
  complete: boolean;
}

export interface SeasonProgress {
  points: number;
  workouts: number;
  /** Weeks that met the target — each one is worth POINTS_PER_FULL_WEEK. */
  fullWeeks: number;
  /** Longest run of consecutive complete weeks, in weeks. */
  longestStreak: number;
  /** Per-week detail, only up to the current week. */
  weeks: SeasonWeekSummary[];
  /** Workouts logged in the current week, and the target it is measured against. */
  thisWeekDone: number;
  thisWeekTarget: number;
}

const DAY = 86_400_000;

/**
 * Everything the season screen says about the reader, from their own log.
 *
 * `weeklyTarget` is the chosen program's days per week. With no program there
 * is no target, and a "full week" cannot be earned — the screen then shows
 * points from workouts alone rather than inventing a target of three.
 */
export function computeSeasonProgress(
  sessions: readonly WorkoutSession[],
  window: SeasonWindow,
  options: { weeklyTarget?: number | null; now?: Date } = {},
): SeasonProgress {
  const { weeklyTarget = null, now = new Date() } = options;
  const currentWeek = Math.max(1, seasonWeek(window, now));

  const perWeek = new Map<number, number>();
  let workouts = 0;

  for (const session of sessions) {
    const stamp = Date.parse(session.performedAt);
    if (!Number.isFinite(stamp) || stamp < window.start.getTime() || stamp >= window.end.getTime()) {
      continue;
    }
    const week = Math.min(SEASON_WEEKS, Math.floor((stamp - window.start.getTime()) / (7 * DAY)) + 1);
    perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
    workouts += 1;
  }

  const weeks: SeasonWeekSummary[] = [];
  let fullWeeks = 0;
  let longestStreak = 0;
  let run = 0;

  for (let week = 1; week <= Math.min(SEASON_WEEKS, currentWeek); week += 1) {
    const done = perWeek.get(week) ?? 0;
    // The week in progress cannot be counted as missed yet — a Tuesday with
    // one of three done is not a broken streak, and treating it as one would
    // reset the badge every Monday morning.
    const isCurrent = week === currentWeek;
    const complete = weeklyTarget !== null && weeklyTarget > 0 && done >= weeklyTarget;

    weeks.push({ week, workouts: done, complete });
    if (complete) {
      fullWeeks += 1;
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else if (!isCurrent) {
      run = 0;
    }
  }

  return {
    points: workouts * POINTS_PER_WORKOUT + fullWeeks * POINTS_PER_FULL_WEEK,
    workouts,
    fullWeeks,
    longestStreak,
    weeks,
    thisWeekDone: perWeek.get(currentWeek) ?? 0,
    thisWeekTarget: weeklyTarget ?? 0,
  };
}

export type SeasonBadgeKey = 'streak12' | 'finished' | 'record';

export interface SeasonBadge {
  key: SeasonBadgeKey;
  earned: boolean;
}

/**
 * The three badges, each with a condition the reader can verify.
 *
 * No badge here is awarded for opening the app, and none is awarded for
 * anything another person did.
 */
export function resolveSeasonBadges(
  progress: SeasonProgress,
  options: { seasonEnded: boolean; personalRecords: number },
): SeasonBadge[] {
  return [
    { key: 'streak12', earned: progress.longestStreak >= 12 },
    // "Season finished" needs the season to actually be over AND the reader to
    // have trained through it, not merely to have been present for the date.
    { key: 'finished', earned: options.seasonEnded && progress.fullWeeks >= 20 },
    { key: 'record', earned: options.personalRecords > 0 },
  ];
}

/**
 * Lifts whose best-ever weight was set inside the season.
 *
 * Not "lifts you trained" and not "lifts with a good number" — the best of the
 * whole log, achieved in these 26 weeks. Anything looser would hand out the
 * record badge for repeating a weight from two years ago.
 */
export function countSeasonRecords(
  lifts: ReadonlyArray<{ bestWeight: number | null; logs: ReadonlyArray<{ weight: number; performedAt: string }> }>,
  window: SeasonWindow,
): number {
  let count = 0;
  for (const lift of lifts) {
    const best = lift.bestWeight ?? 0;
    if (!(best > 0)) {
      continue;
    }
    const setInSeason = lift.logs.some((log) => {
      if (log.weight < best) {
        return false;
      }
      const stamp = Date.parse(log.performedAt);
      return (
        Number.isFinite(stamp) && stamp >= window.start.getTime() && stamp < window.end.getTime()
      );
    });
    if (setInSeason) {
      count += 1;
    }
  }
  return count;
}
