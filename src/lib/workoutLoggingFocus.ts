import { WorkoutTrackingMode } from '../features/workout/workoutTypes';

export type WorkoutAutoFocusTarget = 'load' | 'reps' | null;

interface WorkoutAutoFocusOptions {
  autoFocusNextInput: boolean;
  completedSetsIncreased: boolean;
  movedToNewExercise: boolean;
  trackingMode: WorkoutTrackingMode;
  draftLoadText?: string;
  draftRepsText?: string;
}

function hasValue(value?: string) {
  return (value ?? '').trim().length > 0;
}

export function getActiveSetAutoFocusTarget({
  autoFocusNextInput,
  completedSetsIncreased,
  movedToNewExercise,
  trackingMode,
  draftLoadText,
  draftRepsText,
}: WorkoutAutoFocusOptions): WorkoutAutoFocusTarget {
  if (!autoFocusNextInput || !completedSetsIncreased || movedToNewExercise) {
    return null;
  }

  if (trackingMode === 'bodyweight') {
    return hasValue(draftRepsText) ? null : 'reps';
  }

  if (!hasValue(draftLoadText)) {
    return 'load';
  }

  if (!hasValue(draftRepsText)) {
    return 'reps';
  }

  return null;
}
