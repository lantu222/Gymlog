import { formatRepRange, formatWeight } from './format';
import { getLoadIncrementKg } from './workoutIntelligence';
import { UnitPreference } from '../types/models';
import { WorkoutExerciseInstance, WorkoutSetEffort, WorkoutSetInstance, WorkoutSlotHistoryEntry } from '../features/workout/workoutTypes';

type AdaptiveCoachTone = 'push' | 'steady' | 'recovery';

export interface AdaptiveCoachRecommendation {
  tone: AdaptiveCoachTone;
  title: string;
  targetLine: string;
  restLine: string;
  rationale: string;
  suggestedRestSeconds: number;
}

interface BuildAdaptiveCoachRecommendationInput {
  completedExercise: WorkoutExerciseInstance;
  completedSet: WorkoutSetInstance;
  effort: WorkoutSetEffort;
  nextExercise: WorkoutExerciseInstance;
  nextSetNumber: number;
  unitPreference: UnitPreference;
  previousEntries?: WorkoutSlotHistoryEntry[];
}

function clampRest(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

function formatSetTarget(
  exercise: WorkoutExerciseInstance,
  set: WorkoutSetInstance | undefined,
  unitPreference: UnitPreference,
  fallbackLoadKg?: number,
) {
  if (!set) {
    return 'Open the next set on plan';
  }

  const repRange = formatRepRange(set.plannedRepsMin, set.plannedRepsMax);
  if (exercise.trackingMode === 'bodyweight') {
    return `${repRange} reps`;
  }

  const targetLoadKg = fallbackLoadKg ?? set.actualLoadKg ?? set.plannedLoadKg ?? 0;
  return `${formatWeight(targetLoadKg, unitPreference)} x ${repRange}`;
}

function readLatestHistoryPerformance(previousEntries: WorkoutSlotHistoryEntry[] | undefined) {
  const latestSet = previousEntries?.[0]?.sets?.[0];
  if (!latestSet) {
    return null;
  }

  return `${formatWeight(latestSet.loadKg, 'kg')} x ${latestSet.reps}`;
}

export function buildAdaptiveCoachRecommendation({
  completedExercise,
  completedSet,
  effort,
  nextExercise,
  nextSetNumber,
  unitPreference,
  previousEntries = [],
}: BuildAdaptiveCoachRecommendationInput): AdaptiveCoachRecommendation {
  const nextSet = nextExercise.sets[nextSetNumber - 1];
  const sameExercise = completedExercise.slotId === nextExercise.slotId;
  const plannedFloor = completedSet.plannedRepsMin;
  const plannedCeiling = completedSet.plannedRepsMax;
  const actualReps = completedSet.actualReps ?? plannedFloor;
  const actualLoadKg = completedSet.actualLoadKg ?? completedSet.plannedLoadKg ?? 0;
  const minRest = nextExercise.restSecondsMin;
  const maxRest = Math.max(nextExercise.restSecondsMax, nextExercise.restSecondsMin);
  const incrementKg = getLoadIncrementKg(unitPreference);
  const latestHistory = readLatestHistoryPerformance(previousEntries);

  if (effort === 'easy') {
    const suggestedRestSeconds = sameExercise ? clampRest(minRest - 15, 45, maxRest) : clampRest(minRest - 10, 45, maxRest);
    const addLoad = sameExercise && actualReps >= plannedCeiling && actualLoadKg > 0;
    const targetLoadKg = addLoad ? actualLoadKg + incrementKg : actualLoadKg || nextSet?.plannedLoadKg || 0;

    return {
      tone: 'push',
      title: addLoad ? 'You have room to push' : 'Keep the pace high',
      targetLine: sameExercise
        ? `Next set: ${formatSetTarget(nextExercise, nextSet, unitPreference, targetLoadKg)}`
        : `Next lift: ${nextExercise.exerciseName} | open on plan`,
      restLine: `Rest ${suggestedRestSeconds}s before the next push`,
      rationale: addLoad
        ? 'Top-end reps stayed easy, so a small load jump is on the table.'
        : latestHistory
          ? `You are moving cleaner than the last logged ${latestHistory}.`
          : 'The last set stayed under control, so keep momentum.',
      suggestedRestSeconds,
    };
  }

  if (effort === 'hard') {
    const missedFloor = actualReps < plannedFloor;
    const suggestedRestSeconds = sameExercise ? clampRest(maxRest + 20, minRest, maxRest + 45) : clampRest(maxRest, minRest, maxRest + 30);
    const backedOffLoadKg = actualLoadKg > 0 ? Math.max(0, actualLoadKg - incrementKg) : 0;

    return {
      tone: 'recovery',
      title: missedFloor ? 'Back off and protect the next set' : 'Take a longer reset',
      targetLine: sameExercise
        ? missedFloor
          ? `Next set: ${formatSetTarget(nextExercise, nextSet, unitPreference, backedOffLoadKg)}`
          : `Next set: ${formatSetTarget(nextExercise, nextSet, unitPreference, actualLoadKg || nextSet?.plannedLoadKg || 0)}`
        : `Next lift: ${nextExercise.exerciseName} | start controlled`,
      restLine: `Rest ${suggestedRestSeconds}s to bring quality back`,
      rationale: missedFloor
        ? 'You slipped below the planned floor, so trim the next demand slightly.'
        : 'Keep the load if you want, but buy back quality with more rest.',
      suggestedRestSeconds,
    };
  }

  const suggestedRestSeconds = sameExercise
    ? clampRest((minRest + maxRest) / 2, minRest, maxRest)
    : clampRest(minRest, 45, maxRest);

  return {
    tone: 'steady',
    title: sameExercise ? 'Hold this line' : 'Stay on plan',
    targetLine: sameExercise
      ? `Next set: ${formatSetTarget(nextExercise, nextSet, unitPreference, actualLoadKg || nextSet?.plannedLoadKg || 0)}`
      : `Next lift: ${nextExercise.exerciseName} | keep the normal start`,
    restLine: `Rest ${suggestedRestSeconds}s and repeat the same quality`,
    rationale: latestHistory
      ? `This is right where the plan should land after ${latestHistory}.`
      : 'Good effort means the session is landing where it should.',
    suggestedRestSeconds,
  };
}
