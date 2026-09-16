import { ExerciseLogDraft, ExerciseLogSet } from '../../types/models';
import { WorkoutExerciseInstance, WorkoutSessionRuntime, WorkoutSetStatus, WorkoutTrackingMode } from './workoutTypes';
import { sessionLastActiveMs, workoutSecondsUntil } from '../../lib/sessionClock';

export type LegacyWorkoutDataMismatch =
  | 'template_exercise_id_not_mapped';

export interface AdaptedCompletedWorkoutSet {
  orderIndex: number;
  status: WorkoutSetStatus;
  weightKg: number | null;
  reps: number | null;
  kind: ExerciseLogSet['kind'];
  outcome: ExerciseLogSet['outcome'] | null;
  effort: ExerciseLogSet['effort'];
  performedAt: string | null;
  skippedReason?: string | null;
}

export interface AdaptedCompletedWorkoutExercise {
  slotId: string;
  templateSlotId: string;
  templateExerciseId: string;
  persistedExerciseTemplateId: string | null;
  exerciseName: string;
  tracked: boolean;
  /** Carried so the finish screen can say "45 s" instead of "45 reps". */
  trackingMode: WorkoutTrackingMode;
  orderIndex: number;
  skipped: boolean;
  sessionInserted: boolean;
  notes: string | null;
  swappedFrom: string | null;
  sets: AdaptedCompletedWorkoutSet[];
}

export interface AdaptedCompletedWorkoutSession {
  sessionId: string;
  workoutTemplateId: string;
  workoutTemplateSessionId: string | null;
  workoutNameSnapshot: string;
  startedAt: string;
  performedAt: string;
  /** Start to finish less every pause: the number the player's clock showed. */
  durationMinutes: number;
  exercises: AdaptedCompletedWorkoutExercise[];
  logs: ExerciseLogDraft[];
  legacyShapeMismatches: LegacyWorkoutDataMismatch[];
}

/**
 * How long after the last logged set a finish still belongs to that workout.
 * A cooldown or a slow walk to the phone fits well inside it; a session left
 * open overnight does not.
 */
const STALE_FINISH_MS = 2 * 60 * 60 * 1000;

/**
 * When the workout ended.
 *
 * It was `updatedAt`, which the clock moved to now on every tick while a rest
 * timer ran. A phone that closed the app mid-rest and was reopened days later
 * saved the workout on the day it was reopened, with a duration of thousands
 * of minutes. Past a couple of hours since the last logged set, the last set is
 * when the workout ended.
 *
 * The clock no longer moves `updatedAt` during a rest (2026-09-16); the rest
 * is read at `nowMs` instead, so finishing mid-rest still ends the workout now.
 */
function resolveFinishedAt(session: WorkoutSessionRuntime, nowMs: number): string {
  if (session.completedAt) {
    return session.completedAt;
  }
  let lastSet: string | null = null;
  let lastSetMs = -Infinity;
  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      const time = set.status === 'completed' && set.completedAt ? Date.parse(set.completedAt) : Number.NaN;
      if (Number.isFinite(time) && time > lastSetMs) {
        lastSet = set.completedAt ?? null;
        lastSetMs = time;
      }
    });
  });
  const activeMs = sessionLastActiveMs(session, nowMs);
  if (lastSet && Number.isFinite(activeMs) && activeMs - lastSetMs > STALE_FINISH_MS) {
    return lastSet;
  }
  if (!Number.isFinite(activeMs) || activeMs === Date.parse(session.updatedAt)) {
    return session.updatedAt;
  }
  return new Date(activeMs).toISOString();
}

function sortByOrderIndex<T extends { orderIndex: number }>(items: T[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => left.item.orderIndex - right.item.orderIndex || left.index - right.index)
    .map(({ item }) => item);
}

function isTrackedExercise(exercise: WorkoutExerciseInstance) {
  return exercise.progressionPriority !== 'low';
}

function adaptExerciseStatus(
  status: WorkoutExerciseInstance['status'],
): ExerciseLogDraft['status'] {
  if (status === 'completed' || status === 'skipped' || status === 'swapped') {
    return status;
  }

  return 'active';
}

function adaptSetForBridge(
  set: WorkoutExerciseInstance['sets'][number],
): AdaptedCompletedWorkoutSet {
  return {
    orderIndex: set.setIndex,
    status: set.status,
    weightKg: typeof set.actualLoadKg === 'number' ? set.actualLoadKg : null,
    reps: typeof set.actualReps === 'number' ? set.actualReps : null,
    kind: 'working',
    outcome: set.status === 'completed' ? 'completed' : set.status === 'skipped' ? 'skipped' : null,
    effort: set.effort ?? null,
    performedAt: set.completedAt ?? null,
    skippedReason: set.skippedReason ?? null,
  };
}

function adaptExerciseForBridge(exercise: WorkoutExerciseInstance): AdaptedCompletedWorkoutExercise {
  return {
    slotId: exercise.slotId,
    templateSlotId: exercise.templateSlotId,
    templateExerciseId: exercise.templateExerciseId,
    persistedExerciseTemplateId: exercise.persistedExerciseTemplateId ?? null,
    exerciseName: exercise.exerciseName,
    tracked: isTrackedExercise(exercise),
    trackingMode: exercise.trackingMode,
    orderIndex: exercise.orderIndex,
    skipped: exercise.status === 'skipped',
    sessionInserted: exercise.sessionInserted === true,
    notes: exercise.notes?.trim() ? exercise.notes.trim() : null,
    swappedFrom: exercise.sourceExerciseName?.trim() ? exercise.sourceExerciseName.trim() : null,
    sets: sortByOrderIndex(exercise.sets.map(adaptSetForBridge)),
  };
}

function adaptExerciseToLogDraft(exercise: WorkoutExerciseInstance): ExerciseLogDraft {
  const sets = sortByOrderIndex(
    exercise.sets.map((set) => ({
      orderIndex: set.setIndex,
      weight: set.actualLoadKg ?? 0,
      reps: set.actualReps ?? 0,
      kind: 'working' as const,
      outcome: set.status === 'completed' ? ('completed' as const) : set.status === 'skipped' ? ('skipped' as const) : null,
      status: set.status,
      effort: set.effort ?? null,
      completedAt: set.completedAt ?? null,
      skippedReason: set.skippedReason ?? null,
    })),
  );

  return {
    exerciseTemplateId: exercise.sessionInserted ? null : exercise.persistedExerciseTemplateId ?? null,
    exerciseNameSnapshot: exercise.exerciseName,
    sets,
    tracked: isTrackedExercise(exercise),
    orderIndex: exercise.orderIndex,
    skipped: exercise.status === 'skipped',
    sessionInserted: exercise.sessionInserted === true,
    status: adaptExerciseStatus(exercise.status),
    slotId: exercise.slotId,
    templateSlotId: exercise.templateSlotId,
    templateExerciseId: exercise.templateExerciseId,
    notes: exercise.notes?.trim() ? exercise.notes.trim() : null,
    swappedFrom: exercise.sourceExerciseName?.trim() ? exercise.sourceExerciseName.trim() : null,
  } satisfies ExerciseLogDraft;
}

function shouldPersistExercise(exercise: WorkoutExerciseInstance) {
  if (exercise.status === 'skipped' || exercise.sessionInserted === true) {
    return true;
  }

  if (exercise.notes?.trim() || exercise.sourceExerciseName?.trim()) {
    return true;
  }

  return exercise.sets.some((set) => set.status !== 'pending' || set.edited);
}

function collectLegacyShapeMismatches(
  exercises: AdaptedCompletedWorkoutExercise[],
): LegacyWorkoutDataMismatch[] {
  const mismatches = new Set<LegacyWorkoutDataMismatch>();

  exercises.forEach((exercise) => {
    if (exercise.templateExerciseId && !exercise.persistedExerciseTemplateId) {
      mismatches.add('template_exercise_id_not_mapped');
    }
  });

  return Array.from(mismatches.values()).sort();
}

export function buildAdaptedCompletedWorkoutExercises(
  session: WorkoutSessionRuntime,
): AdaptedCompletedWorkoutExercise[] {
  return sortByOrderIndex(session.exercises.map(adaptExerciseForBridge));
}

export function buildExerciseLogDraftsFromWorkoutSession(session: WorkoutSessionRuntime): ExerciseLogDraft[] {
  return sortByOrderIndex(session.exercises.filter(shouldPersistExercise).map(adaptExerciseToLogDraft));
}

export function adaptCompletedWorkoutSessionForAppDatabase(
  session: WorkoutSessionRuntime,
  nowMs: number = Date.now(),
): AdaptedCompletedWorkoutSession {
  const exercises = buildAdaptedCompletedWorkoutExercises(session);
  const performedAt = resolveFinishedAt(session, nowMs);

  return {
    sessionId: session.sessionId,
    workoutTemplateId: session.templateId,
    workoutTemplateSessionId: session.templateSessionId,
    workoutNameSnapshot: session.templateName,
    startedAt: session.startedAt,
    performedAt,
    // Less the pauses. The save used finish minus start, so an hour with a
    // twenty-minute pause went into history as sixty minutes while the player
    // had shown forty.
    durationMinutes: Math.max(1, Math.round(workoutSecondsUntil(session, Date.parse(performedAt)) / 60) || 1),
    exercises,
    logs: buildExerciseLogDraftsFromWorkoutSession(session),
    legacyShapeMismatches: collectLegacyShapeMismatches(exercises),
  };
}

