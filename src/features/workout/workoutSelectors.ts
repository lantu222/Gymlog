import { formatWeightInputValue } from '../../lib/format';
import { WorkoutFeatureState, getHistoryEntriesForExercise } from './workoutState';
import { WorkoutExerciseInstance, WorkoutHistoryStore, WorkoutSessionRuntime, WorkoutSetInstance } from './workoutTypes';

export function selectWorkoutState(state: WorkoutFeatureState) {
  return state;
}

export function selectActiveWorkoutSession(state: WorkoutFeatureState): WorkoutSessionRuntime | null {
  return state.activeSession;
}

export function selectActiveExerciseFromState(state: WorkoutFeatureState): WorkoutExerciseInstance | null {
  if (!state.activeSession || !state.activeSession.ui.activeSlotId) {
    return null;
  }
  return state.activeSession.exercises.find((exercise) => exercise.slotId === state.activeSession?.ui.activeSlotId) ?? null;
}

export function selectNextExerciseFromState(state: WorkoutFeatureState): WorkoutExerciseInstance | null {
  if (!state.activeSession) {
    return null;
  }
  const activeIndex = state.activeSession.exercises.findIndex((exercise) => exercise.slotId === state.activeSession?.ui.activeSlotId);
  const startIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
  return (
    state.activeSession.exercises.slice(startIndex).find((exercise) => exercise.status === 'pending' || exercise.status === 'active' || exercise.status === 'swapped') ??
    state.activeSession.exercises.find((exercise, index) => index < startIndex && (exercise.status === 'pending' || exercise.status === 'active' || exercise.status === 'swapped')) ??
    null
  );
}

export function selectActiveSet(exercise: WorkoutExerciseInstance | null): WorkoutSetInstance | null {
  if (!exercise) {
    return null;
  }
  return exercise.sets.find((set) => set.status !== 'completed') ?? exercise.sets[exercise.sets.length - 1] ?? null;
}

export function selectRemainingSets(exercise: WorkoutExerciseInstance | null) {
  if (!exercise) {
    return 0;
  }
  return exercise.sets.filter((set) => set.status !== 'completed').length;
}

export function selectRestTimerRemainingSeconds(state: WorkoutFeatureState) {
  if (!state.activeSession?.restTimer.endsAtMs) {
    return null;
  }
  return Math.max(0, Math.ceil((state.activeSession.restTimer.endsAtMs - state.nowMs) / 1000));
}

export function selectProgressionHint(state: WorkoutFeatureState, slotId: string) {
  const exercise = state.activeSession?.exercises.find((item) => item.slotId === slotId);
  const history = getHistoryEntriesForExercise(state.history, exercise)[0];
  if (!exercise || !history) {
    return null;
  }

  const lastSet = history.sets[history.sets.length - 1];
  if (!lastSet) {
    return null;
  }

  const templateSet = exercise.sets[0];
  if (!templateSet) {
    return null;
  }

  if (lastSet.reps >= templateSet.plannedRepsMax) {
    return `Next: ${formatWeightInputValue(lastSet.loadKg + 2.5, 'kg')} kg`;
  }

  if (lastSet.reps >= templateSet.plannedRepsMin) {
    return 'Repeat load and beat reps';
  }

  return 'Repeat last load';
}

export function selectCompletionSummary(state: WorkoutFeatureState) {
  return state.completionSummary;
}

export function selectHistoryBySlot(state: WorkoutFeatureState, slotId: string): WorkoutHistoryStore['slotHistory'][string] {
  const exercise = state.activeSession?.exercises.find((item) => item.slotId === slotId);
  return getHistoryEntriesForExercise(state.history, exercise ?? (slotId ? { slotId, templateSlotId: slotId } : null));
}



