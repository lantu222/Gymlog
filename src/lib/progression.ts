import {
  AppDatabase,
  BodyweightEntry,
  ExerciseLog,
  ExerciseTemplate,
  WorkoutPlan,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/models';
import { getComparableLogSets } from './exerciseLog';

export interface ExerciseLogWithSession extends ExerciseLog {
  performedAt: string;
  workoutNameSnapshot: string;
}

export interface ExerciseProgressSummary {
  key: string;
  name: string;
  logs: ExerciseLogWithSession[];
  latestLog?: ExerciseLogWithSession;
  previousLog?: ExerciseLogWithSession;
  latestWeight: number | null;
  previousWeight: number | null;
  latestReps: string;
  bestWeight: number | null;
  bestReps: number;
}

export interface BodyweightProgressSummary {
  latest?: BodyweightEntry;
  previous?: BodyweightEntry;
  entries: BodyweightEntry[];
}

export interface ExerciseProgressSignal {
  kind: 'new_best' | 'moving_up' | 'below_last' | 'building' | 'starting';
  label: string;
}

export interface SessionSummary {
  session: WorkoutSession;
  logs: ExerciseLog[];
  setsCompleted: number;
  totalVolume: number;
}

function normalizeExerciseKey(name: string) {
  return name.trim().toLowerCase();
}

function resolveCanonicalExerciseName(log: ExerciseLog, exercisesById: Record<string, ExerciseTemplate>) {
  if (log.exerciseTemplateId) {
    const template = exercisesById[log.exerciseTemplateId];
    if (template?.name) {
      return template.name.trim();
    }
  }

  return log.exerciseNameSnapshot.trim();
}

function attachSession(
  log: ExerciseLog,
  sessionsById: Record<string, WorkoutSession>,
): ExerciseLogWithSession | null {
  const session = sessionsById[log.sessionId];
  if (!session) {
    return null;
  }

  return {
    ...log,
    performedAt: session.performedAt,
    workoutNameSnapshot: session.workoutNameSnapshot,
  };
}

function getTopComparableWeight(log: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>) {
  const sets = getComparableLogSets(log);
  if (sets.length === 0) {
    return null;
  }

  return sets.reduce((best, set) => Math.max(best, set.weight), 0);
}

function getComparableReps(log: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>) {
  return getComparableLogSets(log).map((set) => set.reps);
}

export function getTotalReps(repsPerSet: number[]) {
  return repsPerSet.reduce((sum, reps) => sum + reps, 0);
}

export function getCompletedSetCount(logs: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>[]) {
  return logs.reduce((sum, log) => sum + (log.skipped ? 0 : getComparableLogSets(log).length), 0);
}

export function getTotalVolume(log: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>) {
  return getComparableLogSets(log).reduce((sum, set) => sum + set.weight * set.reps, 0);
}

export function getSessionTotalVolume(
  logs: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'>[],
) {
  return logs.reduce((sum, log) => sum + (log.skipped ? 0 : getTotalVolume(log)), 0);
}

export function getLatestLogForTemplateExercise(database: AppDatabase, exerciseTemplateId: string) {
  const sessionsById = Object.fromEntries(
    database.workoutSessions.map((session) => [session.id, session] as const),
  );

  return database.exerciseLogs
    .filter((log) => log.exerciseTemplateId === exerciseTemplateId && !log.skipped)
    .map((log) => attachSession(log, sessionsById))
    .filter((log): log is ExerciseLogWithSession => Boolean(log))
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())[0];
}

export function getRecentLogsForTemplateExercise(database: AppDatabase, exerciseTemplateId: string, limit = 2) {
  const sessionsById = Object.fromEntries(
    database.workoutSessions.map((session) => [session.id, session] as const),
  );

  return database.exerciseLogs
    .filter((log) => log.exerciseTemplateId === exerciseTemplateId && !log.skipped)
    .map((log) => attachSession(log, sessionsById))
    .filter((log): log is ExerciseLogWithSession => Boolean(log))
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
    .slice(0, limit);
}

export function getRecentLogsForExercise(database: AppDatabase, exerciseName: string, limit = 2) {
  const sessionsById = Object.fromEntries(
    database.workoutSessions.map((session) => [session.id, session] as const),
  );
  const normalizedName = normalizeExerciseKey(exerciseName);
  const exercisesById = Object.fromEntries(
    database.exerciseTemplates.map((exercise) => [exercise.id, exercise] as const),
  );

  return database.exerciseLogs
    .filter((log) => {
      if (log.skipped) {
        return false;
      }

      return normalizeExerciseKey(resolveCanonicalExerciseName(log, exercisesById)) === normalizedName;
    })
    .map((log) => attachSession(log, sessionsById))
    .filter((log): log is ExerciseLogWithSession => Boolean(log))
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime())
    .slice(0, limit);
}
export function getTrackedExerciseProgress(database: AppDatabase): ExerciseProgressSummary[] {
  const exercisesById = Object.fromEntries(
    database.exerciseTemplates.map((exercise) => [exercise.id, exercise] as const),
  );
  const sessionsById = Object.fromEntries(
    database.workoutSessions.map((session) => [session.id, session] as const),
  );
  const grouped = new Map<string, { name: string; logs: ExerciseLogWithSession[] }>();

  database.exerciseLogs.forEach((log) => {
    if (!log.tracked || log.skipped) {
      return;
    }

    const attachedLog = attachSession(log, sessionsById);
    if (!attachedLog) {
      return;
    }

    const name = resolveCanonicalExerciseName(log, exercisesById);
    const key = normalizeExerciseKey(name);
    const existing = grouped.get(key);

    if (existing) {
      existing.logs.push(attachedLog);
      existing.name = name;
      return;
    }

    grouped.set(key, { name, logs: [attachedLog] });
  });

  const exerciseLibraryById = Object.fromEntries(
    database.exerciseLibrary.map((item) => [item.id, item] as const),
  );

  database.preferences.trackedExerciseLibraryItemIds.forEach((libraryItemId) => {
    const libraryItem = exerciseLibraryById[libraryItemId];
    if (!libraryItem) {
      return;
    }

    const key = normalizeExerciseKey(libraryItem.name);
    if (grouped.has(key)) {
      return;
    }

    grouped.set(key, {
      name: libraryItem.name,
      logs: [],
    });
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => {
      const logs = value.logs.sort(
        (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
      );
      const latestLog = logs[0];
      const previousLog = logs[1];
      const bestWeight = logs.reduce<number | null>((best, log) => {
        const topWeight = getTopComparableWeight(log);
        if (topWeight === null) {
          return best;
        }

        if (best === null || topWeight > best) {
          return topWeight;
        }

        return best;
      }, null);
      const bestReps = logs.reduce((best, log) => Math.max(best, getTotalReps(getComparableReps(log))), 0);

      return {
        key,
        name: value.name,
        logs,
        latestLog,
        previousLog,
        latestWeight: latestLog ? getTopComparableWeight(latestLog) : null,
        previousWeight: previousLog ? getTopComparableWeight(previousLog) : null,
        latestReps: latestLog ? getComparableReps(latestLog).join(',') : '-',
        bestWeight,
        bestReps,
      };
    })
    .sort((left, right) => {
      const leftDate = left.latestLog ? new Date(left.latestLog.performedAt).getTime() : 0;
      const rightDate = right.latestLog ? new Date(right.latestLog.performedAt).getTime() : 0;
      return rightDate - leftDate;
    });
}

export function getBodyweightProgress(database: AppDatabase): BodyweightProgressSummary {
  const entries = [...database.bodyweightEntries].sort(
    (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  );

  return {
    latest: entries[0],
    previous: entries[1],
    entries,
  };
}

export function getExerciseProgressSignal(summary: ExerciseProgressSummary): ExerciseProgressSignal {
  if (
    summary.latestWeight !== null &&
    summary.bestWeight !== null &&
    summary.logs.length > 1 &&
    Math.abs(summary.latestWeight - summary.bestWeight) < 0.0001
  ) {
    return {
      kind: 'new_best',
      label: 'New best',
    };
  }

  if (
    summary.latestWeight !== null &&
    summary.previousWeight !== null &&
    summary.latestWeight - summary.previousWeight > 0.0001
  ) {
    return {
      kind: 'moving_up',
      label: 'Moving up',
    };
  }

  if (
    summary.latestWeight !== null &&
    summary.previousWeight !== null &&
    summary.previousWeight - summary.latestWeight > 0.0001
  ) {
    return {
      kind: 'below_last',
      label: 'Below last',
    };
  }

  if (summary.logs.length >= 3) {
    return {
      kind: 'building',
      label: 'Building',
    };
  }

  return {
    kind: 'starting',
    label: 'Starting',
  };
}

export function getLatestLogForExercise(database: AppDatabase, exerciseName: string) {
  const progress = getTrackedExerciseProgress(database);
  return progress.find((item) => item.key === normalizeExerciseKey(exerciseName))?.latestLog;
}

export function getBestWeightForExercise(database: AppDatabase, exerciseName: string) {
  const progress = getTrackedExerciseProgress(database);
  return progress.find((item) => item.key === normalizeExerciseKey(exerciseName))?.bestWeight ?? null;
}

export function getSessionSummary(database: AppDatabase, sessionId: string): SessionSummary | null {
  const session = database.workoutSessions.find((item) => item.id === sessionId);
  if (!session) {
    return null;
  }

  const logs = database.exerciseLogs
    .filter((log) => log.sessionId === sessionId)
    .sort((left, right) => left.orderIndex - right.orderIndex);

  return {
    session,
    logs,
    setsCompleted: getCompletedSetCount(logs),
    totalVolume: getSessionTotalVolume(logs),
  };
}

export function getMostRecentSessionSummary(database: AppDatabase): SessionSummary | null {
  const latestSession = [...database.workoutSessions].sort(
    (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
  )[0];

  if (!latestSession) {
    return null;
  }

  return getSessionSummary(database, latestSession.id);
}

export function getWorkoutTemplateMap(templates: WorkoutTemplate[]) {
  return Object.fromEntries(templates.map((template) => [template.id, template] as const));
}

export function getActivePlan(database: AppDatabase): WorkoutPlan | null {
  const activePlanId = database.preferences.activePlanId;
  if (activePlanId) {
    const match = database.workoutPlans.find((plan) => plan.id === activePlanId);
    if (match) {
      return match;
    }
  }

  return null;
}

