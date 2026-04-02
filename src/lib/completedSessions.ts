import { getComparableLogSets } from './exerciseLog';
import { AppDatabase, WorkoutSession } from '../types/models';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
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

export function getSessionsThisWeek(database: AppDatabase, now = new Date()) {
  const currentWeekStart = getCalendarWeekStartTimestamp(now);

  return getCanonicalCompletedSessions(database).filter(
    (session) => getCalendarWeekStartTimestamp(session.performedAt) === currentWeekStart,
  ).length;
}

export function getSessionsLast30Days(database: AppDatabase, now = new Date()) {
  const nowTimestamp = new Date(now).getTime();
  const windowStart = nowTimestamp - 30 * DAY_MS;

  return getCanonicalCompletedSessions(database).filter((session) => {
    const performedAt = new Date(session.performedAt).getTime();
    return performedAt >= windowStart && performedAt <= nowTimestamp;
  }).length;
}

export function getRecentActivityStrip(database: AppDatabase, now = new Date(), days = 16) {
  const todayStart = getCalendarDayStartTimestamp(now);
  const activeDays = new Set(
    getCanonicalCompletedSessions(database).map((session) => getCalendarDayStartTimestamp(session.performedAt)),
  );
  const items = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(todayStart - index * DAY_MS);
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
    getCanonicalCompletedSessions(database).map((session) => getCalendarDayStartTimestamp(session.performedAt)),
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
    getCanonicalCompletedSessions(database).map((session) => getCalendarWeekStartTimestamp(session.performedAt)),
  );

  let streak = 0;
  let cursor = currentWeekStart;

  while (activeWeeks.has(cursor)) {
    streak += 1;
    cursor -= WEEK_MS;
  }

  return streak;
}
