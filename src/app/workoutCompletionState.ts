import { AdaptedCompletedWorkoutExercise } from '../features/workout/workoutAppAdapter';
import { PostSessionInsight } from '../lib/postSessionInsight';
import { getTopSetLabel, MuscleFocusRow } from '../lib/workoutCompleteView';
import {
  buildExercisePrLookup,
  estimateOneRepMaxKg,
  resolvePreviousExercisePr,
  WorkoutCompletionExerciseCard,
  WorkoutCompletionPrCard,
} from '../lib/workoutCompletionSummary';
import {
  AppLanguage,
  ExerciseLibraryItem,
  ExerciseLog,
  ExerciseLogDraft,
  ExerciseTemplate,
} from '../types/models';

/**
 * What the finish flow hands the summary and celebration screens.
 *
 * Assembly only — the judgement calls (what counts as a PR, what a top set
 * reads as) live in src/lib. Moved out of App.tsx in the phase-A split
 * (2026-08-26): this is the completion domain's shape, not wiring.
 */
export interface CompletionSummaryState {
  sessionId: string;
  workoutName: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  volumeDeltaKg: number | null;
  muscles: MuscleFocusRow[];
  exerciseCards: WorkoutCompletionExerciseCard[];
  prCards: WorkoutCompletionPrCard[];
  insight: PostSessionInsight | null;
}

export interface WorkoutCelebrationState {
  workoutName: string;
  heroImageUrl: string | null;
  workoutsThisWeek: number;
  totalLiftedKgThisWeek: number;
  totalDurationMinutesThisWeek: number;
  prCount: number;
}

function isWorkoutCompletionPrCard(
  card: WorkoutCompletionPrCard | null,
): card is WorkoutCompletionPrCard {
  return card !== null;
}

export function buildCompletionCardsFromAdaptedSession({
  exercises,
  exerciseTemplates,
  exerciseLibrary,
  exercisePrLookup,
  language,
}: {
  exercises: AdaptedCompletedWorkoutExercise[];
  exerciseTemplates: ExerciseTemplate[];
  exerciseLibrary: ExerciseLibraryItem[];
  exercisePrLookup: ReturnType<typeof buildExercisePrLookup>;
  language: AppLanguage;
}) {
  const templatesById = new Map(exerciseTemplates.map((item) => [item.id, item] as const));
  const libraryById = new Map(exerciseLibrary.map((item) => [item.id, item] as const));

  const exerciseCards: WorkoutCompletionExerciseCard[] = exercises.map((exercise) => {
    const template = exercise.persistedExerciseTemplateId
      ? templatesById.get(exercise.persistedExerciseTemplateId) ?? null
      : null;
    const libraryItem = template?.libraryItemId ? libraryById.get(template.libraryItemId) ?? null : null;
    const completedSets = exercise.sets.filter((set) => set.status === 'completed').length;
    const totalVolumeKg = exercise.sets.reduce((total, set) => {
      if (set.status !== 'completed') {
        return total;
      }
      const weightKg = typeof set.weightKg === 'number' ? set.weightKg : 0;
      const reps = typeof set.reps === 'number' ? set.reps : 0;
      return total + weightKg * reps;
    }, 0);

    return {
      id: exercise.slotId,
      name: exercise.exerciseName,
      imageUrl: libraryItem?.imageUrls?.[0] ?? null,
      completedSets,
      totalSets: Math.max(1, exercise.sets.length),
      totalVolumeKg,
      notes: exercise.notes,
      topSetLabel: getTopSetLabel(exercise.sets, language, exercise.trackingMode),
    };
  });

  const prCards: WorkoutCompletionPrCard[] = exercises
    .map((exercise): WorkoutCompletionPrCard | null => {
      const template = exercise.persistedExerciseTemplateId
        ? templatesById.get(exercise.persistedExerciseTemplateId) ?? null
        : null;
      const libraryItem = template?.libraryItemId ? libraryById.get(template.libraryItemId) ?? null : null;
      const bestSet = exercise.sets.reduce<{
        estimatedOneRepMaxKg: number;
        performedWeightKg: number;
        performedReps: number;
      } | null>((best, set) => {
        if (set.status !== 'completed' || typeof set.weightKg !== 'number' || typeof set.reps !== 'number') {
          return best;
        }

        const estimate = estimateOneRepMaxKg(set.weightKg, set.reps);
        if (estimate === null) {
          return best;
        }

        if (!best || estimate > best.estimatedOneRepMaxKg) {
          return {
            estimatedOneRepMaxKg: estimate,
            performedWeightKg: set.weightKg,
            performedReps: set.reps,
          };
        }

        return best;
      }, null);

      if (!bestSet) {
        return null;
      }

      const previousBestOneRepMaxKg = resolvePreviousExercisePr({
        libraryItemId: template?.libraryItemId ?? null,
        exerciseName: exercise.exerciseName,
        lookup: exercisePrLookup,
      });

      if (previousBestOneRepMaxKg !== null && bestSet.estimatedOneRepMaxKg <= previousBestOneRepMaxKg + 0.05) {
        return null;
      }

      return {
        id: `pr:${exercise.slotId}`,
        exerciseName: exercise.exerciseName,
        imageUrl: libraryItem?.imageUrls?.[0] ?? null,
        estimatedOneRepMaxKg: bestSet.estimatedOneRepMaxKg,
        previousBestOneRepMaxKg,
        performedWeightKg: bestSet.performedWeightKg,
        performedReps: bestSet.performedReps,
      };
    })
    .filter(isWorkoutCompletionPrCard)
    .slice(0, 3);

  // Mark the recap rows whose exercise earned a PR this session.
  const prSlotIds = new Set(prCards.map((card) => card.id.replace(/^pr:/, '')));
  const exerciseCardsWithPr = exerciseCards.map((card) =>
    prSlotIds.has(card.id) ? { ...card, isPr: true } : card,
  );

  return {
    exerciseCards: exerciseCardsWithPr,
    prCards,
  };
}

export function buildExerciseLogsForCompletedSession(sessionId: string, drafts: ExerciseLogDraft[]): ExerciseLog[] {
  return drafts.map((draft, index) => ({
    id: `draft:${sessionId}:${index}`,
    sessionId,
    exerciseTemplateId: draft.exerciseTemplateId,
    exerciseNameSnapshot: draft.exerciseNameSnapshot,
    weight: draft.skipped ? 0 : draft.weight ?? 0,
    repsPerSet: draft.skipped ? [] : draft.repsPerSet ?? [],
    sets: draft.sets,
    tracked: draft.tracked,
    orderIndex: draft.orderIndex,
    skipped: draft.skipped,
    sessionInserted: draft.sessionInserted,
    status: draft.status,
    slotId: draft.slotId,
    templateSlotId: draft.templateSlotId,
    templateExerciseId: draft.templateExerciseId,
    notes: draft.notes,
    swappedFrom: draft.swappedFrom,
  }));
}

export function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + diff);
  return next;
}

export function getEndOfWeek(date: Date) {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return end;
}
