import { createId } from './ids';
import {
  ExerciseLibraryItem,
  ExerciseTemplate,
  WorkoutSession,
  ExerciseLog,
} from '../types/models';

interface RecentExercisesOptions {
  exerciseLibrary: ExerciseLibraryItem[];
  exerciseLogs: ExerciseLog[];
  workoutSessions: WorkoutSession[];
  exerciseTemplates: ExerciseTemplate[];
  limit?: number;
}

interface SuggestedExercisesOptions {
  exerciseLibrary: ExerciseLibraryItem[];
  currentItemIds: string[];
  recentItems?: ExerciseLibraryItem[];
  limit?: number;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function shouldTrackByDefault(item?: ExerciseLibraryItem) {
  if (!item) {
    return true;
  }

  return item.category === 'compound';
}

export function getExerciseTemplateDefaults(item: ExerciseLibraryItem | undefined, defaultRestSeconds: number) {
  if (!item) {
    return {
      targetSets: 3,
      repMin: 6,
      repMax: 8,
      restSeconds: defaultRestSeconds,
      trackedDefault: true,
    };
  }

  if (item.category === 'isolation') {
    return {
      targetSets: 3,
      repMin: 10,
      repMax: 12,
      restSeconds: Math.min(defaultRestSeconds, 75),
      trackedDefault: shouldTrackByDefault(item),
    };
  }

  if (item.category === 'core') {
    return {
      targetSets: 3,
      repMin: 12,
      repMax: 15,
      restSeconds: Math.min(defaultRestSeconds, 60),
      trackedDefault: false,
    };
  }

  if (item.category === 'cardio') {
    return {
      targetSets: 1,
      repMin: 8,
      repMax: 12,
      restSeconds: Math.min(defaultRestSeconds, 45),
      trackedDefault: false,
    };
  }

  return {
    targetSets: 3,
    repMin: 6,
    repMax: 8,
    restSeconds: defaultRestSeconds,
    trackedDefault: shouldTrackByDefault(item),
  };
}

export function createSessionExerciseFromLibraryItem(
  item: ExerciseLibraryItem,
  workoutTemplateId: string,
  workoutTemplateSessionId: string,
  orderIndex: number,
  defaultRestSeconds: number,
): ExerciseTemplate {
  const defaults = getExerciseTemplateDefaults(item, defaultRestSeconds);

  return {
    id: createId('session_exercise'),
    persistedExerciseTemplateId: null,
    workoutTemplateId,
    workoutTemplateSessionId,
    name: item.name,
    targetSets: defaults.targetSets,
    repMin: defaults.repMin,
    repMax: defaults.repMax,
    restSeconds: defaults.restSeconds,
    trackedDefault: defaults.trackedDefault,
    orderIndex,
    libraryItemId: item.id,
  };
}

export function getRecentExerciseLibraryItems({
  exerciseLibrary,
  exerciseLogs,
  workoutSessions,
  exerciseTemplates,
  limit = 8,
}: RecentExercisesOptions) {
  const sessionsById = new Map(workoutSessions.map((session) => [session.id, session] as const));
  const templateById = new Map(exerciseTemplates.map((exercise) => [exercise.id, exercise] as const));
  const libraryById = new Map(exerciseLibrary.map((item) => [item.id, item] as const));
  const libraryByName = new Map(exerciseLibrary.map((item) => [normalizeName(item.name), item] as const));

  const ranked = exerciseLogs
    .map((log) => {
      const session = sessionsById.get(log.sessionId);
      const template = log.exerciseTemplateId ? templateById.get(log.exerciseTemplateId) : undefined;
      const libraryItem =
        (template?.libraryItemId ? libraryById.get(template.libraryItemId) : undefined) ??
        libraryByName.get(normalizeName(log.exerciseNameSnapshot));

      if (!session || !libraryItem) {
        return null;
      }

      return {
        libraryItem,
        performedAt: session.performedAt,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((left, right) => new Date(right.performedAt).getTime() - new Date(left.performedAt).getTime());

  const seen = new Set<string>();
  const result: ExerciseLibraryItem[] = [];

  for (const entry of ranked) {
    if (seen.has(entry.libraryItem.id)) {
      continue;
    }

    seen.add(entry.libraryItem.id);
    result.push(entry.libraryItem);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function getSuggestedExerciseLibraryItems({
  exerciseLibrary,
  currentItemIds,
  recentItems = [],
  limit = 6,
}: SuggestedExercisesOptions) {
  const currentIds = new Set(currentItemIds);
  const currentItems = exerciseLibrary.filter((item) => currentIds.has(item.id));
  const preferredBodyParts = new Set(currentItems.map((item) => item.bodyPart));
  const preferredEquipment = new Set(currentItems.map((item) => item.equipment));

  const scored = exerciseLibrary
    .filter((item) => !currentIds.has(item.id))
    .map((item) => {
      const recentBonus = recentItems.findIndex((recent) => recent.id === item.id);
      let score = 0;

      if (preferredBodyParts.has(item.bodyPart)) {
        score += 5;
      }
      if (preferredEquipment.has(item.equipment)) {
        score += 2;
      }
      if (item.category === 'compound') {
        score += 2;
      }
      if (recentBonus >= 0) {
        score += Math.max(1, 4 - recentBonus);
      }

      return { item, score };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.name.localeCompare(right.item.name);
    });

  return scored.slice(0, limit).map((entry) => entry.item);
}


