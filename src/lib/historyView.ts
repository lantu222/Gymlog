import { ExerciseLog, WorkoutSession } from '../types/models';
import { getComparableLogSets } from './exerciseLog';
import { getCompletedSetCount, getSessionTotalVolume } from './progression';

export type HistoryFilter = 'all' | 'needs_review' | 'tracked';

export interface HistorySessionViewModel {
  sessionId: string;
  workoutName: string;
  performedAt: string;
  durationMinutes: number | null;
  exerciseCount: number;
  skippedExercises: number;
  trackedExercises: number;
  setsCompleted: number;
  totalVolume: number;
  topLiftName: string | null;
  topLiftWeightKg: number | null;
  swappedExercises: number;
  noteCount: number;
  sessionInsertedExercises: number;
  partialExercises: number;
  legacyMismatchCount: number;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function buildHistorySessionViewModel(
  session: WorkoutSession,
  logs: ExerciseLog[],
): HistorySessionViewModel {
  const skippedExercises = logs.filter((log) => log.skipped).length;
  const trackedExercises = logs.filter((log) => log.tracked && !log.skipped).length;
  const swappedExercises =
    typeof session.exercisesSwapped === 'number'
      ? session.exercisesSwapped
      : logs.filter((log) => Boolean(log.swappedFrom)).length;
  const noteCount =
    typeof session.noteCount === 'number' ? session.noteCount : logs.filter((log) => Boolean(log.notes)).length;
  const sessionInsertedExercises =
    typeof session.sessionInsertedCount === 'number'
      ? session.sessionInsertedCount
      : logs.filter((log) => log.sessionInserted === true).length;
  const partialExercises = logs.filter((log) => log.status === 'active').length;
  const legacyMismatchCount = Array.isArray(session.legacyShapeMismatches) ? session.legacyShapeMismatches.length : 0;
  const durationMinutes =
    typeof session.durationMinutes === 'number'
      ? session.durationMinutes
      : typeof session.startedAt === 'string'
        ? Math.max(
            1,
            Math.round((new Date(session.performedAt).getTime() - new Date(session.startedAt).getTime()) / 60000) || 1,
          )
        : null;

  const topLog = logs.reduce<ExerciseLog | null>((best, log) => {
    const logTopWeight = getComparableLogSets(log).reduce((top, set) => Math.max(top, set.weight), 0);
    if (log.skipped || logTopWeight <= 0) {
      return best;
    }

    if (!best) {
      return log;
    }

    const bestTopWeight = getComparableLogSets(best).reduce((top, set) => Math.max(top, set.weight), 0);
    return logTopWeight > bestTopWeight ? log : best;
  }, null);

  const topLiftWeightKg = topLog
    ? getComparableLogSets(topLog).reduce((top, set) => Math.max(top, set.weight), 0)
    : null;

  return {
    sessionId: session.id,
    workoutName: session.workoutNameSnapshot,
    performedAt: session.performedAt,
    durationMinutes,
    exerciseCount: logs.length,
    skippedExercises,
    trackedExercises,
    setsCompleted: getCompletedSetCount(logs),
    totalVolume: getSessionTotalVolume(logs),
    topLiftName: topLog?.exerciseNameSnapshot ?? null,
    topLiftWeightKg,
    swappedExercises,
    noteCount,
    sessionInsertedExercises,
    partialExercises,
    legacyMismatchCount,
  };
}

export function filterHistorySessionViewModels(
  sessions: HistorySessionViewModel[],
  options: { query: string; filter: HistoryFilter },
) {
  const normalizedQuery = normalizeText(options.query);

  return sessions.filter((session) => {
    const skippedExercises = session.skippedExercises ?? 0;
    const partialExercises = session.partialExercises ?? 0;
    const legacyMismatchCount = session.legacyMismatchCount ?? 0;
    const trackedExercises = session.trackedExercises ?? 0;

    if (
      options.filter === 'needs_review' &&
      skippedExercises === 0 &&
      partialExercises === 0 &&
      legacyMismatchCount === 0
    ) {
      return false;
    }

    if (options.filter === 'tracked' && trackedExercises === 0) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizeText(`${session.workoutName} ${session.topLiftName ?? ''}`).includes(normalizedQuery);
  });
}
