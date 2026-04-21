import { getComparableLogSets } from './exerciseLog';
import { ExerciseLog, ExerciseTemplate, WorkoutSession } from '../types/models';

export interface WorkoutCompletionExerciseCard {
  id: string;
  name: string;
  imageUrl?: string | null;
  completedSets: number;
  totalSets: number;
  totalVolumeKg: number;
  notes?: string | null;
}

export interface WorkoutCompletionPrCard {
  id: string;
  exerciseName: string;
  imageUrl?: string | null;
  estimatedOneRepMaxKg: number;
  previousBestOneRepMaxKg: number | null;
  performedWeightKg: number;
  performedReps: number;
}

export interface ExercisePrLookup {
  byLibraryItemId: Record<string, number>;
  byName: Record<string, number>;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function estimateOneRepMaxKg(weightKg: number, reps: number) {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isFinite(reps) || reps <= 0) {
    return null;
  }

  if (reps <= 1) {
    return weightKg;
  }

  return weightKg * (1 + reps / 30);
}

export function buildExercisePrLookup({
  exerciseLogs,
  workoutSessions,
  exerciseTemplates,
}: {
  exerciseLogs: ExerciseLog[];
  workoutSessions: WorkoutSession[];
  exerciseTemplates: ExerciseTemplate[];
}): ExercisePrLookup {
  const sessionsById = new Map(workoutSessions.map((session) => [session.id, session] as const));
  const templatesById = new Map(exerciseTemplates.map((exercise) => [exercise.id, exercise] as const));

  const bestByLibraryItemId = new Map<string, number>();
  const bestByName = new Map<string, number>();

  exerciseLogs.forEach((log) => {
    const session = sessionsById.get(log.sessionId);
    if (!session) {
      return;
    }

    const comparableSets = getComparableLogSets(log);
    comparableSets.forEach((set) => {
      const estimate = estimateOneRepMaxKg(set.weight, set.reps);
      if (estimate === null) {
        return;
      }

      const normalizedName = normalize(log.exerciseNameSnapshot);
      const previousByName = bestByName.get(normalizedName) ?? null;
      if (previousByName === null || estimate > previousByName) {
        bestByName.set(normalizedName, estimate);
      }

      const template = log.exerciseTemplateId ? templatesById.get(log.exerciseTemplateId) ?? null : null;
      if (template?.libraryItemId) {
        const previousByLibrary = bestByLibraryItemId.get(template.libraryItemId) ?? null;
        if (previousByLibrary === null || estimate > previousByLibrary) {
          bestByLibraryItemId.set(template.libraryItemId, estimate);
        }
      }
    });
  });

  return {
    byLibraryItemId: Object.fromEntries(bestByLibraryItemId),
    byName: Object.fromEntries(bestByName),
  };
}

export function resolvePreviousExercisePr({
  libraryItemId,
  exerciseName,
  lookup,
}: {
  libraryItemId?: string | null;
  exerciseName: string;
  lookup: ExercisePrLookup;
}) {
  if (libraryItemId && typeof lookup.byLibraryItemId[libraryItemId] === 'number') {
    return lookup.byLibraryItemId[libraryItemId];
  }

  const normalizedName = normalize(exerciseName);
  if (normalizedName && typeof lookup.byName[normalizedName] === 'number') {
    return lookup.byName[normalizedName];
  }

  return null;
}
