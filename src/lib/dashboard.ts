import { AppDatabase, UnitPreference, WorkoutPlan, WorkoutPlanEntry } from '../types/models';
import {
  getCalendarWeekStartTimestamp,
  getCanonicalCompletedSessions,
  getCurrentWeekStreak,
  getMonthlyActivityCalendar,
  getRecentActivityStrip,
  getSessionsLast30Days,
  getSessionsThisWeek,
} from './completedSessions';
import { getComparableLogSets } from './exerciseLog';
import { convertWeightFromKg, formatLogSetSummary, formatVolume, removeTrailingZeros } from './format';
import { getActivePlan, getBodyweightProgress, getMostRecentSessionSummary, getRecentLogsForExercise } from './progression';

export interface HomeLastSessionDeltaSummary {
  sessionId: string;
  title: string;
  value: string;
  detail: string;
}

export interface HomeStreakSummary {
  currentWeekStreak: number;
  sessionsThisWeek: number;
  sessionsLast30Days: number;
  calendar: {
    monthLabel: string;
    weekdayLabels: string[];
    weeks: Array<
      Array<{
        dayStart: number;
        dayNumber: number;
        active: boolean;
        isToday: boolean;
        inCurrentMonth: boolean;
      }>
    >;
  };
  activity: {
    days: Array<{
      dayStart: number;
      dayNumber: number;
      weekdayLabel: string;
      active: boolean;
      isToday: boolean;
    }>;
  };
  value: string;
  label: string;
  detail: string;
}

export interface HomeSummary {
  nextWorkout: ReturnType<typeof getNextWorkoutCandidate>;
  lastSession: ReturnType<typeof getMostRecentSessionSummary>;
  lastSessionDelta: HomeLastSessionDeltaSummary | null;
  bodyweight: ReturnType<typeof getBodyweightProgress>;
  weeklySnapshot: {
    workoutsCurrent: number;
    workoutsPrevious: number;
    durationCurrentMinutes: number;
    durationPreviousMinutes: number;
    volumeCurrentKg: number;
    volumePreviousKg: number;
  };
  sessionsThisWeek: number;
  streak: HomeStreakSummary;
}

function normalizeWeekday(label: string) {
  const normalized = label.trim().toLowerCase();
  const map: Record<string, number> = {
    monday: 1,
    maanantai: 1,
    tuesday: 2,
    tiistai: 2,
    wednesday: 3,
    keskiviikko: 3,
    thursday: 4,
    torstai: 4,
    friday: 5,
    perjantai: 5,
    saturday: 6,
    lauantai: 6,
    sunday: 0,
    sunnuntai: 0,
  };

  return map[normalized];
}

function getDayDistance(fromDay: number, toDay: number) {
  return (toDay - fromDay + 7) % 7;
}

function sortPlanEntries(plan: WorkoutPlan) {
  return [...plan.entries].sort((left, right) => left.orderIndex - right.orderIndex);
}

export function getWorkoutMap(database: AppDatabase) {
  return Object.fromEntries(database.workoutTemplates.map((template) => [template.id, template] as const));
}

export function getNextWorkoutCandidate(database: AppDatabase) {
  const workoutsById = getWorkoutMap(database);
  const activePlan = getActivePlan(database);

  if (activePlan && activePlan.entries.length) {
    const entries = sortPlanEntries(activePlan);

    if (activePlan.mode === 'rotation') {
      const latestPlanSession = getCanonicalCompletedSessions(database)
        .filter((session) => entries.some((entry) => entry.workoutTemplateId === session.workoutTemplateId))
        .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())[0];

      const latestIndex = latestPlanSession
        ? entries.findIndex((entry) => entry.workoutTemplateId === latestPlanSession.workoutTemplateId)
        : -1;
      const entry = entries[(latestIndex + 1 + entries.length) % entries.length];
      const workout = workoutsById[entry.workoutTemplateId];

      if (workout) {
        return {
          workout,
          plan: activePlan,
          entry,
          subtitle: `${activePlan.name} - Next in rotation`,
        };
      }
    }

    const today = new Date().getDay();
    const datedEntries = entries
      .map((entry) => ({ entry, day: normalizeWeekday(entry.label) }))
      .filter((item): item is { entry: WorkoutPlanEntry; day: number } => typeof item.day === 'number')
      .sort((left, right) => {
        const distanceLeft = getDayDistance(today, left.day);
        const distanceRight = getDayDistance(today, right.day);
        return distanceLeft - distanceRight || left.entry.orderIndex - right.entry.orderIndex;
      });

    const weekdayEntry = datedEntries[0]?.entry ?? entries[0];
    const workout = workoutsById[weekdayEntry.workoutTemplateId];
    if (workout) {
      return {
        workout,
        plan: activePlan,
        entry: weekdayEntry,
        subtitle: `${activePlan.name} - ${weekdayEntry.label}`,
      };
    }
  }

  const fallback = [...database.workoutTemplates].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];

  if (!fallback) {
    return null;
  }

  return {
    workout: fallback,
    plan: null,
    entry: null,
    subtitle: 'Quick start',
  };
}

function getLastSessionDelta(database: AppDatabase, unitPreference: UnitPreference): HomeLastSessionDeltaSummary | null {
  const latestSession = getMostRecentSessionSummary(database);
  if (!latestSession) {
    return null;
  }

  for (const log of latestSession.logs) {
    if (log.skipped || !log.tracked) {
      continue;
    }

    const exerciseName = log.exerciseNameSnapshot.trim();
    const recentLogs = getRecentLogsForExercise(database, exerciseName, 4);
    const latestLog = recentLogs.find((entry) => entry.sessionId === latestSession.session.id);
    const previousLog = recentLogs.find((entry) => entry.sessionId !== latestSession.session.id);

    if (!latestLog || !previousLog) {
      continue;
    }

    const latestSets = getComparableLogSets(latestLog);
    const previousSets = getComparableLogSets(previousLog);
    const latestTopWeight = latestSets.reduce<number | null>(
      (best, set) => (best === null ? set.weight : Math.max(best, set.weight)),
      null,
    );
    const previousTopWeight = previousSets.reduce<number | null>(
      (best, set) => (best === null ? set.weight : Math.max(best, set.weight)),
      null,
    );

    if (latestTopWeight !== null && previousTopWeight !== null) {
      const delta = convertWeightFromKg(latestTopWeight - previousTopWeight, unitPreference);
      if (Math.abs(delta) >= 0.05) {
        const sign = delta > 0 ? '+' : '';
        return {
          sessionId: latestSession.session.id,
          title: exerciseName,
          value: `${sign}${removeTrailingZeros(delta)} ${unitPreference}`,
          detail: `Vs ${formatLogSetSummary(previousLog, unitPreference)}`,
        };
      }
    }

    return {
      sessionId: latestSession.session.id,
      title: exerciseName,
      value: formatLogSetSummary(latestLog, unitPreference),
      detail: `Vs ${formatLogSetSummary(previousLog, unitPreference)}`,
    };
  }

  return {
    sessionId: latestSession.session.id,
    title: latestSession.session.workoutNameSnapshot,
    value: formatVolume(latestSession.totalVolume, unitPreference),
    detail: `${latestSession.setsCompleted} sets completed`,
  };
}

function getHomeStreak(database: AppDatabase): HomeStreakSummary {
  const sessionsThisWeek = getSessionsThisWeek(database);
  const sessionsLast30Days = getSessionsLast30Days(database);
  const currentWeekStreak = getCurrentWeekStreak(database);
  const calendar = getMonthlyActivityCalendar(database);
  const activity = getRecentActivityStrip(database);

  return {
    currentWeekStreak,
    sessionsThisWeek,
    sessionsLast30Days,
    calendar,
    activity: {
      days: activity,
    },
    value: `${currentWeekStreak}`,
    label: currentWeekStreak === 1 ? 'active week' : 'active weeks',
    detail: `${sessionsLast30Days} ${sessionsLast30Days === 1 ? 'workout' : 'workouts'} in 30 days`,
  };
}

function getSessionDurationMinutes(session: AppDatabase['workoutSessions'][number]) {
  if (typeof session.durationMinutes === 'number' && Number.isFinite(session.durationMinutes)) {
    return session.durationMinutes;
  }

  if (session.startedAt) {
    const duration = Math.round((new Date(session.performedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
    if (Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  }

  return 0;
}

function getSessionVolumeKg(session: AppDatabase['workoutSessions'][number]) {
  if (typeof session.totalVolumeKg === 'number' && Number.isFinite(session.totalVolumeKg)) {
    return session.totalVolumeKg;
  }

  return 0;
}

function getHomeWeeklySnapshot(database: AppDatabase, now = new Date()) {
  const currentWeekStart = getCalendarWeekStartTimestamp(now);
  const previousWeekStart = currentWeekStart - 7 * 24 * 60 * 60 * 1000;
  const sessions = getCanonicalCompletedSessions(database);

  const currentWeekSessions = sessions.filter(
    (session) => getCalendarWeekStartTimestamp(session.performedAt) === currentWeekStart,
  );
  const previousWeekSessions = sessions.filter(
    (session) => getCalendarWeekStartTimestamp(session.performedAt) === previousWeekStart,
  );

  return {
    workoutsCurrent: currentWeekSessions.length,
    workoutsPrevious: previousWeekSessions.length,
    durationCurrentMinutes: currentWeekSessions.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0),
    durationPreviousMinutes: previousWeekSessions.reduce((sum, session) => sum + getSessionDurationMinutes(session), 0),
    volumeCurrentKg: currentWeekSessions.reduce((sum, session) => sum + getSessionVolumeKg(session), 0),
    volumePreviousKg: previousWeekSessions.reduce((sum, session) => sum + getSessionVolumeKg(session), 0),
  };
}

export function getHomeSummary(database: AppDatabase, unitPreference: UnitPreference): HomeSummary {
  const sessionsThisWeek = getSessionsThisWeek(database);

  return {
    nextWorkout: getNextWorkoutCandidate(database),
    lastSession: getMostRecentSessionSummary(database),
    lastSessionDelta: getLastSessionDelta(database, unitPreference),
    bodyweight: getBodyweightProgress(database),
    weeklySnapshot: getHomeWeeklySnapshot(database),
    sessionsThisWeek,
    streak: getHomeStreak(database),
  };
}
