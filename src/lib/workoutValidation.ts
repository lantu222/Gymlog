import { WorkoutTrackingMode } from '../features/workout/workoutTypes';

function hasTextValue(value: string) {
  return value.trim().length > 0;
}

export function canCompleteWorkoutSet(
  trackingMode: WorkoutTrackingMode,
  loadValue: string,
  repsValue: string,
) {
  if (trackingMode === 'bodyweight') {
    return hasTextValue(repsValue);
  }

  return hasTextValue(loadValue) && hasTextValue(repsValue);
}

export function getWorkoutSetValidationMessage(
  trackingMode: WorkoutTrackingMode,
  loadValue: string,
  repsValue: string,
): string | null {
  const hasLoad = hasTextValue(loadValue);
  const hasReps = hasTextValue(repsValue);

  if (trackingMode === 'bodyweight') {
    return hasReps ? null : 'Add reps to complete this set.';
  }

  if (!hasLoad && !hasReps) {
    return null;
  }

  if (!hasLoad) {
    return 'Add load to complete this set.';
  }

  if (!hasReps) {
    return 'Add reps to complete this set.';
  }

  return null;
}
