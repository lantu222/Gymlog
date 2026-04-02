import { getComparableLogSets } from './exerciseLog';
import { convertWeightToKg } from './format';
import { ExerciseLog, ExerciseLogSet, UnitPreference } from '../types/models';

const EPSILON = 0.0001;

export type ProgressionAction = 'increase' | 'hold' | 'repeat' | 'reduce';
export type BeatLastTimeAction = 'beat-by-reps' | 'beat-by-load' | 'match-previous-best';

export interface WorkingSetSummary {
  weight: number;
  reps: number;
  orderIndex: number;
}

export interface ProgressionSuggestion {
  action: ProgressionAction;
  targetWeightKg: number;
  targetRepsMin: number;
  targetRepsMax: number;
}

function isSuccessfulWorkingSet(set: ExerciseLogSet) {
  return set.kind === 'working' && set.outcome === 'completed' && set.reps > 0;
}

function isClose(a: number, b: number) {
  return Math.abs(a - b) < EPSILON;
}

export function getLoadIncrementKg(unitPreference: UnitPreference) {
  return unitPreference === 'kg' ? 2.5 : convertWeightToKg(5, 'lb');
}

export function getComparableSuccessfulWorkingSets(
  log?: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null,
) {
  return getComparableLogSets(log).filter(isSuccessfulWorkingSet).map<WorkingSetSummary>((set) => ({
    weight: set.weight,
    reps: set.reps,
    orderIndex: set.orderIndex,
  }));
}

export function getLastComparableWorkingSet(
  log?: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null,
) {
  const sets = getComparableSuccessfulWorkingSets(log);
  return sets.length ? sets[sets.length - 1] : null;
}

export function getBestComparableWorkingSet(
  log?: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null,
) {
  const sets = getComparableSuccessfulWorkingSets(log);
  if (sets.length === 0) {
    return null;
  }

  return [...sets].sort((left, right) => {
    if (!isClose(left.weight, right.weight)) {
      return right.weight - left.weight;
    }

    if (left.reps !== right.reps) {
      return right.reps - left.reps;
    }

    return left.orderIndex - right.orderIndex;
  })[0];
}

export function buildProgressionSuggestion(
  previousLogs: Array<Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null | undefined>,
  repMin: number,
  repMax: number,
  unitPreference: UnitPreference,
): ProgressionSuggestion | null {
  const latestPreviousLog = previousLogs[0] ?? null;
  const bestSet = getBestComparableWorkingSet(latestPreviousLog);

  if (!bestSet) {
    return null;
  }

  const increment = getLoadIncrementKg(unitPreference);
  const previousSessionBest = previousLogs[1] ? getBestComparableWorkingSet(previousLogs[1]) : null;

  if (bestSet.reps >= repMax) {
    return {
      action: 'increase',
      targetWeightKg: bestSet.weight + increment,
      targetRepsMin: repMin,
      targetRepsMax: repMax,
    };
  }

  if (bestSet.reps >= repMin) {
    return {
      action: 'hold',
      targetWeightKg: bestSet.weight,
      targetRepsMin: bestSet.reps + 1,
      targetRepsMax: bestSet.reps + 1,
    };
  }

  if (
    previousSessionBest &&
    isClose(previousSessionBest.weight, bestSet.weight) &&
    previousSessionBest.reps < repMin &&
    bestSet.reps < repMin
  ) {
    return {
      action: 'reduce',
      targetWeightKg: Math.max(0, bestSet.weight - increment),
      targetRepsMin: repMin,
      targetRepsMax: repMax,
    };
  }

  return {
    action: 'repeat',
    targetWeightKg: bestSet.weight,
    targetRepsMin: repMin,
    targetRepsMax: repMax,
  };
}

export function buildBeatLastTimeAction(
  currentWeightKg: number,
  currentReps: number,
  previousLog?: Pick<ExerciseLog, 'weight' | 'repsPerSet' | 'sets' | 'skipped'> | null,
  unitPreference: UnitPreference = 'kg',
) {
  const lastComparable = getLastComparableWorkingSet(previousLog);
  const bestComparable = getBestComparableWorkingSet(previousLog);

  if (!lastComparable || !bestComparable) {
    return null;
  }

  const increment = getLoadIncrementKg(unitPreference);

  if (isClose(currentWeightKg, lastComparable.weight) && currentReps >= lastComparable.reps + 1) {
    return 'beat-by-reps' as const;
  }

  if (currentWeightKg >= lastComparable.weight + increment - EPSILON && currentReps >= lastComparable.reps) {
    return 'beat-by-load' as const;
  }

  if (isClose(currentWeightKg, bestComparable.weight) && currentReps === bestComparable.reps) {
    return 'match-previous-best' as const;
  }

  return null;
}
