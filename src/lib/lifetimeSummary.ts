import { AppDatabase } from '../types/models';
import {
  getCalendarWeekStartBefore,
  getCalendarWeekStartTimestamp,
  getCanonicalCompletedSessions,
} from './completedSessions';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface LifetimeTrainingSummary {
  /** Deduplicated completed-session count (same rule as the streak/calendar). */
  sessionCount: number;
  /** Sum of stored session volume in kg across all completed sessions. */
  totalVolumeKg: number;
  /** Distinct calendar weeks that contain at least one completed session. */
  weeksActive: number;
  /** Calendar weeks from the first completed session's week to the current week, inclusive. */
  weeksSinceStart: number;
  /** Longest run of consecutive active weeks ever recorded. */
  bestWeekStreak: number;
  /** ISO timestamp of the earliest completed session, or null when none exist. */
  firstSessionAt: string | null;
}

function getSessionVolumeKg(totalVolumeKg: number | null | undefined) {
  if (typeof totalVolumeKg === 'number' && Number.isFinite(totalVolumeKg)) {
    return Math.max(0, totalVolumeKg);
  }
  return 0;
}

/**
 * Lifetime training totals for the Profile screen. Reuses the canonical
 * completed-session set and calendar-week math that the Progress/Home streak
 * and activity calendar already rely on, so the numbers stay consistent.
 */
export function getLifetimeTrainingSummary(
  database: AppDatabase,
  now: Date = new Date(),
): LifetimeTrainingSummary {
  const sessions = getCanonicalCompletedSessions(database);

  if (sessions.length === 0) {
    return {
      sessionCount: 0,
      totalVolumeKg: 0,
      weeksActive: 0,
      weeksSinceStart: 0,
      bestWeekStreak: 0,
      firstSessionAt: null,
    };
  }

  const totalVolumeKg = sessions.reduce((total, session) => total + getSessionVolumeKg(session.totalVolumeKg), 0);

  const activeWeekStarts = [
    ...new Set(sessions.map((session) => getCalendarWeekStartTimestamp(session.performedAt))),
  ].sort((left, right) => left - right);

  let bestWeekStreak = 1;
  let runLength = 1;
  for (let index = 1; index < activeWeekStarts.length; index += 1) {
    if (getCalendarWeekStartBefore(activeWeekStarts[index]) === activeWeekStarts[index - 1]) {
      runLength += 1;
    } else {
      runLength = 1;
    }
    bestWeekStreak = Math.max(bestWeekStreak, runLength);
  }

  const firstWeekStart = activeWeekStarts[0];
  const currentWeekStart = getCalendarWeekStartTimestamp(now);
  // WEEK_MS survives here on purpose: a span of N weeks is N * 168 hours give or
  // take the one hour a clock change adds or removes, and Math.round absorbs
  // 1/168 of a week. It is a count of weeks elapsed, not a week start to look
  // up, so calendar stepping buys nothing — but the rounding is what makes it
  // safe, and floor would be off by one after every change.
  const weeksSinceStart = Math.max(1, Math.round((currentWeekStart - firstWeekStart) / WEEK_MS) + 1);

  // sessions are sorted newest-first, so the earliest is the last entry.
  const firstSessionAt = sessions[sessions.length - 1].performedAt;

  return {
    sessionCount: sessions.length,
    totalVolumeKg,
    weeksActive: activeWeekStarts.length,
    weeksSinceStart,
    bestWeekStreak,
    firstSessionAt,
  };
}
