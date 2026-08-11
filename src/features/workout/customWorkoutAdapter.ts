import { ExerciseLibraryItem, ExerciseTemplate, WorkoutTemplate, WorkoutTemplateSessionWithExercises } from '../../types/models';
import {
  WorkoutProgressionPriority,
  WorkoutRole,
  WorkoutRuntimeTemplate,
  WorkoutTemplateExercise,
  WorkoutTrackingMode,
} from './workoutTypes';

import { WORKOUT_SUBSTITUTION_GROUPS } from './workoutCatalog';
import { isHoldExerciseName } from '../../lib/holdExercises';

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

/**
 * The catalog swap group this exercise belongs to, by name.
 *
 * Every custom template used to get `custom_<exerciseId>` — a group of one,
 * belonging to no catalog — so nothing in a custom plan could ever be
 * substituted. That includes the plan onboarding builds and saves for the
 * user, which is most plans. The list logger opened an empty swap sheet and
 * the guided player showed no swap row at all.
 *
 * The synthetic id remains the fallback: an exercise the catalog does not
 * group has no honest alternatives to offer.
 */
function resolveSubstitutionGroup(exerciseName: string, fallbackId: string): string {
  const normalized = normalizeName(exerciseName);
  const group = WORKOUT_SUBSTITUTION_GROUPS.find((candidate) =>
    candidate.allowedExerciseNames.some((allowed) => normalizeName(allowed) === normalized),
  );
  return group?.id ?? `custom_${fallbackId}`;
}

function getTrackingMode(exercise: ExerciseTemplate, libraryItem?: ExerciseLibraryItem): WorkoutTrackingMode {
  // Asked before the equipment check: a hold is bodyweight, so the branch
  // below would swallow it and a plank in your own program would ask for
  // repetitions while the same plank in a ready program asked for seconds.
  if (isHoldExerciseName(libraryItem?.name ?? exercise.name)) {
    return 'hold';
  }

  if (libraryItem?.equipment === 'bodyweight') {
    return 'bodyweight';
  }

  if (libraryItem?.category === 'core' || libraryItem?.category === 'cardio') {
    return 'reps_first';
  }

  return 'load_and_reps';
}

function getRole(exercise: ExerciseTemplate, libraryItem?: ExerciseLibraryItem): WorkoutRole {
  if (libraryItem?.category === 'compound') {
    return 'secondary';
  }

  return exercise.trackedDefault ? 'secondary' : 'accessory';
}

function getPriority(exercise: ExerciseTemplate, libraryItem?: ExerciseLibraryItem): WorkoutProgressionPriority {
  if (libraryItem?.category === 'compound') {
    return 'medium';
  }

  return exercise.trackedDefault ? 'medium' : 'low';
}

function adaptExercise(
  exercise: ExerciseTemplate,
  exerciseLibrary: ExerciseLibraryItem[],
  defaultRestSeconds: number,
): WorkoutTemplateExercise {
  const libraryById = new Map(exerciseLibrary.map((item) => [item.id, item] as const));
  const libraryItem =
    (exercise.libraryItemId ? libraryById.get(exercise.libraryItemId) : undefined) ??
    exerciseLibrary.find((item) => normalizeName(item.name) === normalizeName(exercise.name));

  return {
    id: exercise.id,
    persistedExerciseTemplateId: exercise.id,
    exerciseName: exercise.name,
    slotId: `custom_slot_${exercise.id}`,
    role: getRole(exercise, libraryItem),
    progressionPriority: getPriority(exercise, libraryItem),
    trackingMode: getTrackingMode(exercise, libraryItem),
    sets: Math.max(1, exercise.targetSets),
    repsMin: Math.max(1, exercise.repMin),
    repsMax: Math.max(Math.max(1, exercise.repMin), exercise.repMax),
    restSecondsMin: exercise.restSeconds && exercise.restSeconds > 0 ? exercise.restSeconds : defaultRestSeconds,
    restSecondsMax: exercise.restSeconds && exercise.restSeconds > 0 ? exercise.restSeconds : defaultRestSeconds,
    substitutionGroup: resolveSubstitutionGroup(exercise.name, exercise.id),
  };
}

export function adaptLegacyWorkoutTemplateToRuntimeTemplate(
  template: WorkoutTemplate,
  sessions: WorkoutTemplateSessionWithExercises[],
  exerciseLibrary: ExerciseLibraryItem[],
  defaultRestSeconds: number,
): WorkoutRuntimeTemplate {
  return {
    id: template.id,
    name: template.name,
    defaultScheduleMode: 'rolling_sequence',
    sessions: sessions
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((session) => ({
        id: session.id,
        name: session.name,
        orderIndex: session.orderIndex,
        exercises: session.exercises
          .slice()
          .sort((left, right) => left.orderIndex - right.orderIndex)
          .map((exercise) => adaptExercise(exercise, exerciseLibrary, defaultRestSeconds)),
      })),
  };
}