import { t } from './i18n';
import { isTimedTrackingMode, isUnloadedTrackingMode, WorkoutTrackingMode } from '../features/workout/workoutTypes';
import { AppLanguage } from '../types/models';

function hasTextValue(value: string) {
  return value.trim().length > 0;
}

export function canCompleteWorkoutSet(
  trackingMode: WorkoutTrackingMode,
  loadValue: string,
  repsValue: string,
) {
  if (isUnloadedTrackingMode(trackingMode)) {
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

  if (isUnloadedTrackingMode(trackingMode)) {
    if (hasReps) {
      return null;
    }
    return t(language, isTimedTrackingMode(trackingMode) ? 'logger.validation.addSeconds' : 'logger.validation.addReps');
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
