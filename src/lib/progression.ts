import {
  AppDatabase,
  AppLanguage,
  BodyweightEntry,
  ExerciseLog,
  ExerciseTemplate,
  WorkoutPlan,
  WorkoutSession,
  WorkoutTemplate,
} from '../types/models';
import { getComparableLogSets, logRecordedWork } from './exerciseLog';
import { t } from './i18n';

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
  /**
   * The one number this lift is judged on, per session.
   *
   * Kilos for a loaded lift; total reps for a lift that is never loaded,
   * because that one does not progress in kilos and reading its weight gives
   * 0 every time. `bestValueBefore` excludes the latest session on purpose —
   * see getExerciseProgressSignal.
   */
  latestValue: number | null;
  previousValue: number | null;
  bestValueBefore: number | null;
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
function finalizeExerciseSummary(
  key: string,
  name: string,
  logs: ExerciseLogWithSession[],
): ExerciseProgressSummary {
  const sortedLogs = [...logs].sort(
    (left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime(),
  );
  const latestLog = sortedLogs[0];
  const previousLog = sortedLogs[1];
  const bestWeight = sortedLogs.reduce<number | null>((best, log) => {
    const topWeight = getTopComparableWeight(log);
    if (topWeight === null) {
      return best;
    }

    if (best === null || topWeight > best) {
      return topWeight;
    }

    return best;
  }, null);
  const bestReps = sortedLogs.reduce((best, log) => Math.max(best, getTotalReps(getComparableReps(log))), 0);

  /**
   * A lift that is never loaded is measured in reps.
   *
   * Its weight reads 0 every session, so "the latest equals the best" is true
   * from the second session onward and stays true — which is how a treadmill
   * HIIT at 0 kg wore "Uusi ennätys" permanently while the lift beside it,
   * which had genuinely done something, wore "Alkuvaihe" (#bugs 2026-08-26).
   * Reps are what the progression rules already raise on a bodyweight lift.
   */
  const byReps = bestWeight === null || bestWeight <= 0;
  const valueOf = (log: ExerciseLogWithSession | undefined): number | null => {
    if (!log) {
      return null;
    }
    if (!byReps) {
      return getTopComparableWeight(log);
    }
    const reps = getTotalReps(getComparableReps(log));
    return reps > 0 ? reps : null;
  };

  return {
    key,
    name,
    logs: sortedLogs,
    latestLog,
    previousLog,
    latestWeight: latestLog ? getTopComparableWeight(latestLog) : null,
    previousWeight: previousLog ? getTopComparableWeight(previousLog) : null,
    latestReps: latestLog ? getComparableReps(latestLog).join(',') : '-',
    bestWeight,
    bestReps,
    latestValue: valueOf(latestLog),
    previousValue: valueOf(previousLog),
    // Newest first, so the history is everything after the first entry.
    bestValueBefore: sortedLogs.slice(1).reduce<number | null>((best, log) => {
      const value = valueOf(log);
      if (value === null) {
        return best;
      }
      return best === null || value > best ? value : best;
    }, null),
  };
}

/**
 * Build a progress summary for a single exercise by name, regardless of whether
 * the user has tracked it. Used by the Exercise Detail screen to show this lift's
 * real history. Returns an empty-logs summary when nothing has been logged yet.
 */
export function getExerciseProgressForName(
  database: AppDatabase,
  exerciseName: string,
): ExerciseProgressSummary {
  const exercisesById = Object.fromEntries(
    database.exerciseTemplates.map((exercise) => [exercise.id, exercise] as const),
  );
  const sessionsById = Object.fromEntries(
    database.workoutSessions.map((session) => [session.id, session] as const),
  );
  const normalizedName = normalizeExerciseKey(exerciseName);

  const logs = database.exerciseLogs
    .filter((log) => {
      if (log.skipped) {
        return false;
      }

      return normalizeExerciseKey(resolveCanonicalExerciseName(log, exercisesById)) === normalizedName;
    })
    .map((log) => attachSession(log, sessionsById))
    .filter((log): log is ExerciseLogWithSession => Boolean(log));

  return finalizeExerciseSummary(normalizedName, exerciseName.trim(), logs);
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
    // An exercise that was listed but never performed is not a session on that
    // lift. Without this, a workout you opened and abandoned reads as a day you
    // lifted zero, and the lift's whole trend follows it down.
    if (!log.tracked || log.skipped || !logRecordedWork(log)) {
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

  /**
   * A lift you have set a TARGET on shows here before you have logged it.
   *
   * This used to be the library's star — "track this" — whose only job was
   * exactly this line. Two ways to say "I care about this lift" is one too
   * many, and the star was the one that asked for nothing back: it put an
   * empty row on Progress and never said what it was for. A target names a
   * number, so the row has something to move towards from the first session
   * (user, 2026-09-01).
   *
   * Keyed by name rather than by library id, because that is what a goal
   * carries and what the logs group on.
   */
  (database.preferences.strengthGoals ?? []).forEach((goal) => {
    const name = goal.exerciseName.trim();
    if (!name) {
      return;
    }
    const key = normalizeExerciseKey(name);
    if (grouped.has(key)) {
      return;
    }
    grouped.set(key, { name, logs: [] });
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => finalizeExerciseSummary(key, value.name, value.logs))
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

export function getExerciseProgressSignal(
  summary: ExerciseProgressSummary,
  language: AppLanguage = 'en',
): ExerciseProgressSignal {
  /**
   * Beaten, not matched.
   *
   * This used to compare the latest session against a best that already
   * contained it — "the latest IS the best" — which is also true of every
   * session that merely repeats it. Combined with an unloaded lift reading 0
   * kg forever, that made the chip permanent, and a chip that is always on
   * says nothing. Mark the exception, not the normal.
   */
  if (
    summary.latestValue !== null &&
    summary.bestValueBefore !== null &&
    summary.latestValue - summary.bestValueBefore > 0.0001
  ) {
    return {
      kind: 'new_best',
      label: t(language, 'signal.newBest'),
    };
  }

  if (
    summary.latestValue !== null &&
    summary.previousValue !== null &&
    summary.latestValue - summary.previousValue > 0.0001
  ) {
    return {
      kind: 'moving_up',
      label: t(language, 'signal.movingUp'),
    };
  }

  if (
    summary.latestValue !== null &&
    summary.previousValue !== null &&
    summary.previousValue - summary.latestValue > 0.0001
  ) {
    return {
      kind: 'below_last',
      label: t(language, 'signal.belowLast'),
    };
  }

  if (summary.logs.length >= 3) {
    return {
      kind: 'building',
      label: t(language, 'signal.building'),
    };
  }

  return {
    kind: 'starting',
    label: t(language, 'signal.starting'),
  };
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

