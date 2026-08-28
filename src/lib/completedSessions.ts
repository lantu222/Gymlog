import { getComparableLogSets } from './exerciseLog';
import { AppDatabase, WorkoutSession } from '../types/models';

const FI_MONTHS = [
  'tammikuu',
  'helmikuu',
  'maaliskuu',
  'huhtikuu',
  'toukokuu',
  'kesakuu',
  'heinakuu',
  'elokuu',
  'syyskuu',
  'lokakuu',
  'marraskuu',
  'joulukuu',
];
const FI_WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];
const FI_WEEKDAYS_SHORT = ['su', 'ma', 'ti', 'ke', 'to', 'pe', 'la'];

function buildCompletedSessionSignature(session: WorkoutSession) {
  return [
    session.workoutTemplateId,
    session.workoutTemplateSessionId ?? '',
    session.workoutNameSnapshot.trim().toLowerCase(),
    new Date(session.performedAt).toISOString(),
  ].join('|');
}

function toDayStart(dateInput: string | Date) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getCalendarDayStartTimestamp(dateInput: string | Date) {
  return toDayStart(dateInput).getTime();
}

export function getCalendarWeekStartTimestamp(dateInput: string | Date) {
  const date = toDayStart(dateInput);
  const weekday = date.getDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - offset);
  return date.getTime();
}

function getSessionIdsWithCompletedSets(database: AppDatabase) {
  const completedSessionIds = new Set<string>();

  for (const log of database.exerciseLogs) {
    if (log.skipped) {
      continue;
    }

    if (getComparableLogSets(log).length === 0) {
      continue;
    }

    completedSessionIds.add(log.sessionId);
  }

  return completedSessionIds;
}

export function getCanonicalCompletedSessions(database: AppDatabase) {
  const completedSessionIds = getSessionIdsWithCompletedSets(database);
  const seenSignatures = new Set<string>();

  return [...database.workoutSessions]
    .filter((session) => completedSessionIds.has(session.id))
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
    .filter((session) => {
      const signature = buildCompletedSessionSignature(session);
      if (seenSignatures.has(signature)) {
        return false;
      }

      seenSignatures.add(signature);
      return true;
    });
}

/**
 * Cardio sessions count toward the activity counters (sessions this week,
 * streaks, calendars) with equal weight to strength sessions — but they are
 * NOT canonical workout sessions: plan progress and program insights stay
 * strength-only.
 */
export function getCanonicalCardioSessions(database: AppDatabase) {
  const seenIds = new Set<string>();
  return [...(database.cardioSessions ?? [])]
    .filter((session) => {
      if (seenIds.has(session.id)) {
        return false;
      }
      seenIds.add(session.id);
      return true;
    })
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime());
}

/** performedAt timestamps of every activity that counts toward streaks. */
function getAllActivityTimestamps(database: AppDatabase) {
  return [
    ...getCanonicalCompletedSessions(database).map((session) => session.performedAt),
    ...getCanonicalCardioSessions(database).map((session) => session.performedAt),
  ];
}

export function getSessionsThisWeek(database: AppDatabase, now = new Date()) {
  const currentWeekStart = getCalendarWeekStartTimestamp(now);

  return getAllActivityTimestamps(database).filter(
    (performedAt) => getCalendarWeekStartTimestamp(performedAt) === currentWeekStart,
  ).length;
}

/**
 * Newest activity timestamp (workout or cardio) in epoch ms, or null when
 * nothing has been logged yet. Drives the comeback nudge and the "already
 * trained today" check in the notification planner.
 */
export function getLastActivityTimestamp(database: AppDatabase): number | null {
  let newest: number | null = null;
  getAllActivityTimestamps(database).forEach((performedAtIso) => {
    const performedAt = new Date(performedAtIso).getTime();
    if (!Number.isFinite(performedAt)) {
      return;
    }
    if (newest === null || performedAt > newest) {
      newest = performedAt;
    }
  });
  return newest;
}

/**
 * Lifted volume of the current calendar week in kg. Sums the stored session
 * volume, the same source the lifetime summary uses, so the weekly-summary
 * notification can never quote a number the app itself would contradict.
 */
export function getVolumeThisWeekKg(database: AppDatabase, now = new Date()) {
  const currentWeekStart = getCalendarWeekStartTimestamp(now);

  return getCanonicalCompletedSessions(database)
    .filter((session) => getCalendarWeekStartTimestamp(session.performedAt) === currentWeekStart)
    .reduce((total, session) => {
      const volume = session.totalVolumeKg;
      return total + (typeof volume === 'number' && Number.isFinite(volume) ? Math.max(0, volume) : 0);
    }, 0);
}

/**
 * Where a rolling window of `days` calendar days back from `now` begins.
 *
 * Calendar stepping, not a count of fixed 24-hour chunks. A window spanning a
 * clock change contains a 23- or 25-hour day, so subtracting `days * DAY_MS`
 * puts the edge an hour off the same time of day that many days back — wide
 * enough to count something older than the window claims to cover, or narrow
 * enough to drop something inside it.
 *
 * One case the Date constructor decides rather than this function: on the hour
 * that spring-forward skips, a wall-clock time that never happens normalizes
 * forward. A window ending 03:30 on such a day therefore starts at 04:30, an
 * hour short. Bounded, twice a year, and better than the alternative of landing
 * an hour off every day of the six months following each change.
 *
 * Exported because more than one surface asks the same question, and two
 * copies of this arithmetic drift apart at exactly the moment it matters.
 */
export function getRollingWindowStart(now: Date | string | number, days: number) {
  return addCalendarDays(now, -days);
}

/**
 * `reference` shifted by whole calendar days, keeping its time of day.
 *
 * The primitive under every window and week helper here. Adding or subtracting
 * `days * DAY_MS` instead drifts an hour whenever the span crosses a clock
 * change, and an hour is the whole distance between a timestamp that matches a
 * stored day or week start and one that matches nothing.
 *
 * One case the Date constructor decides rather than this function: a wall-clock
 * time that spring-forward skips normalizes forward an hour. Under Helsinki's
 * 03:00 transitions only times in that hour are affected, which is why the week
 * helpers below — always at local midnight — are exact.
 */
export function addCalendarDays(reference: Date | string | number, days: number) {
  const date = new Date(reference);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ).getTime();
}

/**
 * The start of the calendar week `weeks` before `weekStart`.
 *
 * `weekStart` is expected to be a local week start, as
 * `getCalendarWeekStartTimestamp` returns. Stepping back by a fixed
 * `weeks * WEEK_MS` lands at 23:00 or 01:00 whenever the span crosses a clock
 * change, and no real week start ever equals that, so every lookup and equality
 * check against a set of week starts silently misses. Under Helsinki's 03:00 transitions local
 * midnight always exists, so this is exact; a zone that moves its clocks at
 * midnight would need the result snapped back through
 * `getCalendarWeekStartTimestamp`.
 */
export function getCalendarWeekStartBefore(weekStart: number, weeks = 1) {
  return addCalendarDays(weekStart, -weeks * 7);
}

/**
 * The start of the calendar week `weeks` after `weekStart`. Same reasoning as
 * `getCalendarWeekStartBefore`, for loops that walk forwards.
 */
export function getCalendarWeekStartAfter(weekStart: number, weeks = 1) {
  return addCalendarDays(weekStart, weeks * 7);
}

export function getSessionsLast30Days(database: AppDatabase, now = new Date()) {
  const nowTimestamp = new Date(now).getTime();
  const windowStart = getRollingWindowStart(now, 30);

  return getAllActivityTimestamps(database).filter((performedAtIso) => {
    const performedAt = new Date(performedAtIso).getTime();
    return performedAt >= windowStart && performedAt <= nowTimestamp;
  }).length;
}

export function getRecentActivityStrip(database: AppDatabase, now = new Date(), days = 16) {
  const today = toDayStart(now);
  const todayStart = today.getTime();
  const activeDays = new Set(
    getAllActivityTimestamps(database).map((performedAt) => getCalendarDayStartTimestamp(performedAt)),
  );
  const items = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    // Calendar stepping, not fixed 24-hour chunks. The day a clock changes is
    // 23 or 25 hours long, so subtracting DAY_MS across one lands at 01:00 or
    // 23:00 — a timestamp no logged day can equal, because `activeDays` holds
    // real local midnights. Every bar before the change would read free, however
    // much was trained.
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index);
    const dayStart = date.getTime();

    items.push({
      dayStart,
      dayNumber: date.getDate(),
      weekdayLabel: FI_WEEKDAYS_SHORT[date.getDay()],
      active: activeDays.has(dayStart),
      isToday: dayStart === todayStart,
    });
  }

  return items;
}

export function getMonthlyActivityCalendar(database: AppDatabase, now = new Date()) {
  const todayStart = getCalendarDayStartTimestamp(now);
  const activeDays = new Set(
    getAllActivityTimestamps(database).map((performedAt) => getCalendarDayStartTimestamp(performedAt)),
  );

  const referenceDate = toDayStart(now);
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  const gridStart = new Date(getCalendarWeekStartTimestamp(monthStart));
  const gridEnd = new Date(getCalendarWeekStartTimestamp(monthEnd));
  gridEnd.setDate(gridEnd.getDate() + 6);
  gridEnd.setHours(0, 0, 0, 0);

  const weeks = [];
  let currentWeek = [];
  const cursor = new Date(gridStart);

  while (cursor.getTime() <= gridEnd.getTime()) {
    const dayStart = cursor.getTime();
    currentWeek.push({
      dayStart,
      dayNumber: cursor.getDate(),
      active: activeDays.has(dayStart),
      isToday: dayStart === todayStart,
      inCurrentMonth: cursor.getMonth() === referenceDate.getMonth(),
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }

  return {
    monthLabel: `${FI_MONTHS[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`,
    weekdayLabels: FI_WEEKDAYS,
    weeks,
  };
}

export function getCurrentWeekStreak(database: AppDatabase, now = new Date()) {
  const currentWeekStart = getCalendarWeekStartTimestamp(now);
  const activeWeeks = new Set(
    getAllActivityTimestamps(database).map((performedAt) => getCalendarWeekStartTimestamp(performedAt)),
  );

  let streak = 0;
  let cursor = currentWeekStart;

  while (activeWeeks.has(cursor)) {
    streak += 1;
    cursor = getCalendarWeekStartBefore(cursor);
  }

  return streak;
}
