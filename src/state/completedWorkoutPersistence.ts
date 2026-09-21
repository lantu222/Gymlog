import { createId } from '../lib/ids';
import { normalizeExerciseLogDraft } from '../lib/exerciseLog';
import { getSessionTotals } from '../lib/sessionTotals';
import { exerciseLogRepository, workoutSessionRepository } from '../storage/repositories';
import { AppDatabase, ExerciseLog, ExerciseLogDraft } from '../types/models';

export interface SessionSaveSummary {
  sessionId: string | null;
  performedAt: string | null;
  exercisesLogged: number;
  trackedExercisesUpdated: number;
  exercisesSwapped: number;
  notesSaved: number;
  sessionInsertedExercises: number;
  entriesSaved: number;
  setsCompleted: number;
  totalVolume: number;
  /**
   * Exercises done, by lib/sessionTotals' rule — what History will say about
   * this session, so the completion screen can say the same.
   */
  exercisesCompleted: number;
  durationMinutes: number;
}

export interface PersistCompletedWorkoutInput {
  sessionId: string;
  workoutTemplateId: string;
  workoutTemplateSessionId?: string | null;
  workoutNameSnapshot: string;
  logs: ExerciseLogDraft[];
  startedAt?: string;
  performedAt?: string;
  /**
   * The session's own count, pauses taken off, when the caller has one. Absent
   * falls back to finish minus start, which is right only for a workout that
   * was never paused.
   */
  durationMinutes?: number;
  legacyShapeMismatches?: string[];
}

export interface PersistCompletedWorkoutResult {
  database: AppDatabase;
  didPersist: boolean;
  summary: SessionSaveSummary;
}

function createEmptySummary(): SessionSaveSummary {
  return {
    sessionId: null,
    performedAt: null,
    exercisesLogged: 0,
    trackedExercisesUpdated: 0,
    exercisesSwapped: 0,
    notesSaved: 0,
    sessionInsertedExercises: 0,
    entriesSaved: 0,
    setsCompleted: 0,
    totalVolume: 0,
    exercisesCompleted: 0,
    durationMinutes: 0,
  };
}

function sortLogDrafts(logs: ExerciseLogDraft[]) {
  return logs
    .map((log, index) => ({ log, index }))
    .sort((left, right) => left.log.orderIndex - right.log.orderIndex || left.index - right.index)
    .map(({ log }) => log);
}

function buildPersistedLogs(
  sessionId: string,
  logs: ExerciseLogDraft[],
  createIdFn: (prefix: string) => string,
): ExerciseLog[] {
  return sortLogDrafts(logs)
    .map((log) => normalizeExerciseLogDraft(log))
    .filter(
      (log) =>
        log.skipped ||
        log.sets.length > 0 ||
        Boolean(log.notes) ||
        Boolean(log.swappedFrom) ||
        log.sessionInserted === true,
    )
    .map((log) => ({
      id: createIdFn('log'),
      sessionId,
      exerciseTemplateId: log.exerciseTemplateId,
      exerciseNameSnapshot: log.exerciseNameSnapshot,
      weight: log.skipped ? 0 : log.weight ?? 0,
      repsPerSet: log.skipped ? [] : log.repsPerSet ?? [],
      sets: log.sets,
      tracked: log.tracked,
      orderIndex: log.orderIndex,
      skipped: log.skipped,
      sessionInserted: log.sessionInserted === true,
      status: log.status ?? (log.skipped ? 'skipped' : 'completed'),
      slotId: log.slotId ?? null,
      templateSlotId: log.templateSlotId ?? null,
      templateExerciseId: log.templateExerciseId ?? null,
      notes: log.notes ?? null,
      swappedFrom: log.swappedFrom ?? null,
    }));
}

function buildSummary(
  input: PersistCompletedWorkoutInput,
  logsToPersist: ExerciseLog[],
  performedAt: string,
): SessionSaveSummary {
  const startTime = input.startedAt ? new Date(input.startedAt).getTime() : new Date(performedAt).getTime();
  const durationMinutes =
    typeof input.durationMinutes === 'number' && Number.isFinite(input.durationMinutes) && input.durationMinutes > 0
      ? Math.max(1, Math.round(input.durationMinutes))
      : Math.max(1, Math.round((new Date(performedAt).getTime() - startTime) / 60000) || 1);
  // The same reading the loader takes of every stored session, so the row
  // written now and the row read back on the next launch cannot differ.
  const totals = getSessionTotals(logsToPersist);

  return {
    sessionId: input.sessionId,
    performedAt,
    exercisesLogged: logsToPersist.length,
    trackedExercisesUpdated: logsToPersist.filter((log) => log.tracked && !log.skipped).length,
    exercisesSwapped: logsToPersist.filter((log) => Boolean(log.swappedFrom)).length,
    notesSaved: logsToPersist.filter((log) => Boolean(log.notes)).length,
    sessionInsertedExercises: logsToPersist.filter((log) => log.sessionInserted === true).length,
    entriesSaved: logsToPersist.length,
    setsCompleted: totals.setsCompleted,
    totalVolume: totals.totalVolumeKg,
    exercisesCompleted: totals.exercisesCompleted,
    durationMinutes,
  };
}

export function persistCompletedWorkoutSessionToDatabase(
  database: AppDatabase,
  input: PersistCompletedWorkoutInput,
  createIdFn: (prefix: string) => string = createId,
): PersistCompletedWorkoutResult {
  const performedAt = input.performedAt ?? new Date().toISOString();
  const logsToPersist = buildPersistedLogs(input.sessionId, input.logs, createIdFn);

  if (logsToPersist.length === 0) {
    return {
      database,
      didPersist: false,
      summary: createEmptySummary(),
    };
  }

  const summary = buildSummary(input, logsToPersist, performedAt);
  if (workoutSessionRepository.findById(database, input.sessionId)) {
    return {
      database,
      didPersist: false,
      summary,
    };
  }

  const nextSession = {
    id: input.sessionId,
    workoutTemplateId: input.workoutTemplateId,
    workoutTemplateSessionId: input.workoutTemplateSessionId ?? null,
    workoutNameSnapshot: input.workoutNameSnapshot,
    sessionNotes: null,
    performedAt,
    startedAt: input.startedAt ?? performedAt,
    completedAt: performedAt,
    durationMinutes: summary.durationMinutes,
    setsCompleted: summary.setsCompleted,
    // Not `status === 'completed'`: a lift swapped and then done keeps its
    // swapped status, and one left with a set still pending stays active.
    // Both were done.
    exercisesCompleted: summary.exercisesCompleted,
    exercisesSkipped: logsToPersist.filter((log) => log.skipped === true || log.status === 'skipped').length,
    exercisesSwapped: summary.exercisesSwapped,
    totalVolumeKg: summary.totalVolume,
    trackedExercisesUpdated: summary.trackedExercisesUpdated,
    noteCount: summary.notesSaved,
    sessionInsertedCount: summary.sessionInsertedExercises,
    legacyShapeMismatches: Array.isArray(input.legacyShapeMismatches) ? input.legacyShapeMismatches : [],
  };

  let nextDatabase = workoutSessionRepository.append(database, nextSession);
  nextDatabase = exerciseLogRepository.appendMany(nextDatabase, logsToPersist);

  return {
    database: nextDatabase,
    didPersist: true,
    summary,
  };
}
