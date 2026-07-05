import { AppDatabase } from '../types/models';
import {
  getCalendarWeekStartTimestamp,
  getCanonicalCompletedSessions,
  getCurrentWeekStreak,
} from './completedSessions';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface TrainingRhythmSummary {
  /** Consecutive active calendar weeks ending at the current week (same rule as the home streak). */
  weeksInRow: number;
  /** Completed sessions per calendar week, oldest → current week (fixed window). */
  sessionsPerWeek: number[];
  /** Sessions completed in the current calendar week. */
  currentWeekSessions: number;
}

/**
 * Weekly training rhythm for the Progress overview: sessions per calendar week
 * over a recent window, plus the consecutive-week run. Reuses the canonical
 * completed-session set and calendar-week math behind the streak and activity
 * calendar so all three surfaces agree.
 */
export function getTrainingRhythm(
  database: AppDatabase,
  options: { weeks?: number; now?: Date } = {},
): TrainingRhythmSummary {
  const weeks = Math.max(1, options.weeks ?? 10);
  const now = options.now ?? new Date();

  const currentWeekStart = getCalendarWeekStartTimestamp(now);
  const counts = new Map<number, number>();
  for (const session of getCanonicalCompletedSessions(database)) {
    const weekStart = getCalendarWeekStartTimestamp(session.performedAt);
    counts.set(weekStart, (counts.get(weekStart) ?? 0) + 1);
  }

  const sessionsPerWeek: number[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    sessionsPerWeek.push(counts.get(currentWeekStart - index * WEEK_MS) ?? 0);
  }

  return {
    weeksInRow: getCurrentWeekStreak(database, now),
    sessionsPerWeek,
    currentWeekSessions: sessionsPerWeek[sessionsPerWeek.length - 1],
  };
}
