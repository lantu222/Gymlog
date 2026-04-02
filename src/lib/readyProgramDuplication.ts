import { WorkoutTemplateV1, WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { ExerciseLibraryItem, WorkoutTemplateDraft } from '../types/models';

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function buildUniqueCustomName(baseName: string, existingNames: string[]) {
  const baseCandidate = `${baseName} Custom`;
  const taken = new Set(existingNames.map(normalizeName));

  if (!taken.has(normalizeName(baseCandidate))) {
    return baseCandidate;
  }

  let index = 2;
  while (taken.has(normalizeName(`${baseCandidate} ${index}`))) {
    index += 1;
  }

  return `${baseCandidate} ${index}`;
}

function resolveTrackedDefault(exercise: WorkoutTemplateExercise) {
  if (exercise.trackingMode === 'bodyweight') {
    return true;
  }

  if (exercise.role === 'accessory' && exercise.progressionPriority === 'low') {
    return false;
  }

  return true;
}

function resolveLibraryItemId(exerciseName: string, exerciseLibrary: ExerciseLibraryItem[]) {
  return exerciseLibrary.find((item) => normalizeName(item.name) === normalizeName(exerciseName))?.id ?? null;
}

export function buildCustomDraftFromReadyProgram(
  template: WorkoutTemplateV1,
  exerciseLibrary: ExerciseLibraryItem[],
  existingCustomNames: string[] = [],
): WorkoutTemplateDraft {
  return {
    name: buildUniqueCustomName(template.name, existingCustomNames),
    sessions: [...template.sessions]
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((session) => ({
        name: session.name,
        exercises: session.exercises.map((exercise) => ({
          name: exercise.exerciseName,
          targetSets: exercise.sets,
          repMin: exercise.repsMin,
          repMax: exercise.repsMax,
          restSeconds: exercise.restSecondsMax,
          trackedDefault: resolveTrackedDefault(exercise),
          libraryItemId: resolveLibraryItemId(exercise.exerciseName, exerciseLibrary),
        })),
      })),
  };
}
