import { WorkoutSession } from '../types/models';
import { SeasonWindow, SEASON_BLOCK_COUNT, SEASON_WEEKS, seasonBlockIndex, seasonWeek } from './season';

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

/**
 * The scale.
 *
 * Calibrated against the design's own leaderboard, which is the only external
 * check available: it puts the reader at 610 points in week 9, about 68 a
 * week, and the leaders near 2 100 over a full season. Ten a workout plus
 * twenty-five for a full week lands at 65 — so attendance and consistency are
 * already in the right range, and the two new awards are headroom on top
 * rather than a rescale.
 *
 * A record is the biggest single award because it is the only number in the
 * whole log that means "you got better". Everything else means "you showed
 * up", which matters and is worth less.
 */
export const POINTS_PER_WORKOUT = 10;
export const POINTS_PER_FULL_WEEK = 25;
export const POINTS_PER_RECORD = 50;
export const POINTS_PER_BLOCK = 100;

/**
 * One record bonus per lift per block, and no more.
 *
 * Without a cap a 50-point record pays for testing a one-rep max every Friday,
 * which is how people get hurt and how a season turns into a max-out contest.
 * Capped per block, the only way to earn it four times is to actually get
 * stronger four times across six months.
 */
export const MAX_RECORDS_PER_LIFT_PER_BLOCK = 1;

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
  /** Capped record bonuses earned — see MAX_RECORDS_PER_LIFT_PER_BLOCK. */
  records: number;
  /** Blocks whose every week was a full one. */
  blocksCompleted: number;
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

/** 7/6/7/6 — the same split seasonBlockIndex draws. */
const BLOCK_LENGTHS = [7, 6, 7, 6];

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
  options: { weeklyTarget?: number | null; now?: Date; records?: number } = {},
): SeasonProgress {
  const { weeklyTarget = null, now = new Date(), records = 0 } = options;
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

  // A block counts only when every one of its weeks was a full one, and only
  // when the block is over — half a block is not a block.
  let blocksCompleted = 0;
  for (let block = 0; block < SEASON_BLOCK_COUNT; block += 1) {
    const inBlock = weeks.filter((entry) => seasonBlockIndex(entry.week) === block);
    const blockLength = BLOCK_LENGTHS[block];
    if (inBlock.length === blockLength && inBlock.every((entry) => entry.complete)) {
      blocksCompleted += 1;
    }
  }

  return {
    points:
      workouts * POINTS_PER_WORKOUT +
      fullWeeks * POINTS_PER_FULL_WEEK +
      records * POINTS_PER_RECORD +
      blocksCompleted * POINTS_PER_BLOCK,
    workouts,
    records,
    blocksCompleted,
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
 * Record bonuses earned, capped at one per lift per block.
 *
 * A record is a log that beat everything before it — walked in order, not
 * compared against a final total, because "the best of the season" counts once
 * while "got stronger four times" is four separate pieces of progress and the
 * whole point of a 26-week block.
 *
 * The per-block cap is what keeps the incentive honest. At 50 points an
 * uncapped record bonus pays for testing a one-rep max every Friday; capped,
 * the only way to earn it four times is to actually get stronger four times.
 */
export function countSeasonRecords(
  lifts: ReadonlyArray<{ logs: ReadonlyArray<{ weight: number; performedAt: string }> }>,
  window: SeasonWindow,
): number {
  let count = 0;

  for (const lift of lifts) {
    const ordered = [...lift.logs]
      .map((log) => ({ weight: log.weight, stamp: Date.parse(log.performedAt) }))
      .filter((log) => Number.isFinite(log.stamp) && log.weight > 0)
      .sort((left, right) => left.stamp - right.stamp);

    let best = 0;
    const blocksHit = new Set<number>();

    for (const log of ordered) {
      if (log.weight <= best) {
        continue;
      }
      best = log.weight;
      // Only a record set INSIDE the window scores. Beating a weight from two
      // years ago is progress; the weight from two years ago is not.
      if (log.stamp >= window.start.getTime() && log.stamp < window.end.getTime()) {
        const week = Math.min(
          SEASON_WEEKS,
          Math.floor((log.stamp - window.start.getTime()) / (7 * DAY)) + 1,
        );
        blocksHit.add(seasonBlockIndex(week));
      }
    }

    count += Math.min(blocksHit.size, SEASON_BLOCK_COUNT) * MAX_RECORDS_PER_LIFT_PER_BLOCK;
  }

  return count;
}
