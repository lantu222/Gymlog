import { t } from './i18n';
import { WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { AppLanguage } from '../types/models';

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
  language: AppLanguage = 'en',
): string | null {
  const hasLoad = hasTextValue(loadValue);
  const hasReps = hasTextValue(repsValue);

  if (trackingMode === 'bodyweight') {
    return hasReps ? null : t(language, 'logger.validation.addReps');
  }

  if (!hasLoad && !hasReps) {
    return null;
  }

  if (!hasLoad) {
    return t(language, 'logger.validation.addLoad');
  }

  if (!hasReps) {
    return t(language, 'logger.validation.addReps');
  }

  return null;
}
