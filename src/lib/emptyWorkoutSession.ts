/**
 * Pure domain logic for the freestyle Empty Workout screen (HG redesign).
 *
 * The screen keeps a small local draft state (exercises + typed sets); this
 * module owns everything derivable from it: the add-sheet muscle filter, the
 * letter-tile initials, and the finish payload (template draft + completion
 * summary) handed to App.tsx on save.
 */
import { parseNumberInput } from './format';
import {
  ExercisePrLookup,
  WorkoutCompletionExerciseCard,
  WorkoutCompletionPrCard,
  estimateOneRepMaxKg,
  resolvePreviousExercisePr,
} from './workoutCompletionSummary';
import { buildPersistedSessionNames } from './workoutEditorNaming';
import { ExerciseBodyPart, ExerciseLogDraft, WorkoutTemplateDraft } from '../types/models';

// ── add-sheet muscle filter ──────────────────────────────────────────────

/** Chip order from the design handoff (empty-workout.jsx). */
export const EMPTY_WORKOUT_MUSCLE_FILTERS = [
  'All',
  'Chest',
  'Back',
  'Shoulders',
  'Legs',
  'Arms',
  'Core',
] as const;

export type EmptyWorkoutMuscleFilter = (typeof EMPTY_WORKOUT_MUSCLE_FILTERS)[number];

const FILTER_BODY_PARTS: Record<Exclude<EmptyWorkoutMuscleFilter, 'All'>, ExerciseBodyPart[]> = {
  Chest: ['chest'],
  Back: ['back'],
  Shoulders: ['shoulders'],
  Legs: ['legs', 'glutes'],
  Arms: ['biceps', 'triceps'],
  Core: ['core'],
};

export function matchesMuscleFilter(bodyPart: ExerciseBodyPart, filter: EmptyWorkoutMuscleFilter) {
  if (filter === 'All') {
    return true;
  }

  return FILTER_BODY_PARTS[filter].includes(bodyPart);
}

// ── letter tiles ─────────────────────────────────────────────────────────

/**
 * Two-letter initials for the purpleLight exercise tile ("Barbell Squat" →
 * "BS", "Pull-Up" → "PU"). Words starting with a letter win over leading
 * numerals ("3/4 Sit-Up" → "SU"); single-word names use their first two
 * letters.
 */
export function exerciseInitials(name: string) {
  const parts = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const letterParts = parts.filter((part) => /^\p{L}/u.test(part));
  const source = letterParts.length > 0 ? letterParts : parts;

  if (source.length === 0) {
    return 'EX';
  }

  if (source.length === 1) {
    return source[0].slice(0, 2).toUpperCase();
  }

  return `${source[0][0]}${source[1][0]}`.toUpperCase();
}

// ── finish payload ───────────────────────────────────────────────────────

export interface FreestyleSetDraft {
  localKey: string;
  kg: string;
  reps: string;
  done: boolean;
}

export interface FreestyleExerciseDraft {
  localKey: string;
  name: string;
  libraryItemId: string | null;
  imageUrl: string | null;
  repMin: number;
  repMax: number;
  restSeconds: number;
  trackedDefault: boolean;
  sets: FreestyleSetDraft[];
}

export interface FreestyleFinishInput {
  exercises: FreestyleExerciseDraft[];
  workoutName: string;
  startedAtIso: string;
  performedAtIso: string;
  elapsedSeconds: number;
  exercisePrLookup: ExercisePrLookup;
}

/** Structurally identical to WorkoutEditorFinishSummary (App.tsx onSave contract). */
export interface FreestyleFinishSummary {
  workoutName: string;
  startedAt: string;
  performedAt: string;
  durationMinutes: number;
  setsCompleted: number;
  totalVolume: number;
  exercisesLogged: number;
  exerciseCards: WorkoutCompletionExerciseCard[];
  prCards: WorkoutCompletionPrCard[];
  logs: ExerciseLogDraft[];
}

export interface FreestyleFinishResult {
  draft: WorkoutTemplateDraft;
  summary: FreestyleFinishSummary;
}

function setVolumeKg(set: FreestyleSetDraft) {
  if (!set.done) {
    return 0;
  }

  const kg = parseNumberInput(set.kg) ?? 0;
  const reps = parseNumberInput(set.reps) ?? 0;
  return kg * reps;
}

/** Volume across done sets, for the live stat strip and the finish summary. */
export function freestyleVolumeKg(exercises: FreestyleExerciseDraft[]) {
  return exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((sum, set) => sum + setVolumeKg(set), 0),
    0,
  );
}

/**
 * The rest to start when a freestyle set is ticked, in seconds — or null when
 * no rest should run.
 *
 * This used to ask a different question: "is another set already waiting?",
 * and started no rest unless one was. The intent was to stop the last tick of
 * a session opening a 2:00 countdown to nothing.
 *
 * It withheld the timer from almost every rest instead. A freestyle session
 * has no plan: you tick the set you just did and THEN press "+ Lisää sarja"
 * for the next one, so at the moment of the tick there is normally nothing
 * waiting and the answer was no. Reported twice from the gym on 2026-08-28 —
 * "tätä lepoa ei tullut kun tein penkkiä" and "lepo sekosi, ei näy mitään" —
 * and reproduced on the emulator: log a set the ordinary way and no bar comes.
 *
 * So a tick always earns its rest. The end-of-session case the old rule was
 * written for costs one tap on Ohita, which is the right price for a guess the
 * app cannot make: nothing at tick time says whether the reader is finished.
 * The bar cannot cover "Lopeta treeni" while it does — the logging list has
 * reserved room for it since the screen was built.
 */
export function freestyleRestSecondsForTick(
  exercise: FreestyleExerciseDraft,
  set: FreestyleSetDraft,
  defaultRestSeconds: number,
): number | null {
  // Un-ticking corrects a mistake; it is not the end of a set. The caller
  // hands over the PRE-toggle set, so this is the one rule about which way
  // the tick is going, and it lives here rather than at the call site.
  if (set.done) {
    return null;
  }

  // Nothing below a second is a rest. Both numbers can arrive unusable — a
  // stored preference reaches getExerciseTemplateDefaults unbounded, and NaN
  // survives every arithmetic step to produce a bar frozen at 0:00 that never
  // ends. A rest that cannot be counted is not started.
  const own = Math.round(exercise.restSeconds);
  const seconds = own > 0 ? own : Math.round(defaultRestSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** Done-set count across the session, for the stat strip. */
/**
 * The set the reader is coming back to, for the rest bar's done state.
 *
 * The design puts a concrete set on that line — "Set 3 · 60 kg × 8" — not a
 * slogan. Empty fields carry the last logged set's numbers forward, which is
 * what the logger itself does when the reader taps in.
 */
export function freestyleNextSetTarget(
  exercises: FreestyleExerciseDraft[],
): { setNumber: number; kg: string; reps: string } | null {
  for (const exercise of exercises) {
    const index = exercise.sets.findIndex((set) => !set.done);
    if (index === -1) {
      continue;
    }
    const set = exercise.sets[index];
    // Carried forward from the nearest logged set above, the way the inputs do.
    const previous = [...exercise.sets.slice(0, index)].reverse().find((entry) => entry.done);
    return {
      setNumber: index + 1,
      kg: set.kg.trim() || previous?.kg.trim() || '',
      reps: set.reps.trim() || previous?.reps.trim() || '',
    };
  }
  return null;
}

export function freestyleDoneSetCount(exercises: FreestyleExerciseDraft[]) {
  return exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.done).length,
    0,
  );
}

function buildLogDrafts(exercises: FreestyleExerciseDraft[], performedAtIso: string): ExerciseLogDraft[] {
  return exercises.map((exercise, orderIndex) => {
    const sets = exercise.sets.map((set, setIndex) => ({
      orderIndex: setIndex,
      weight: parseNumberInput(set.kg) ?? 0,
      reps: parseNumberInput(set.reps) ?? 0,
      kind: 'working' as const,
      outcome: set.done ? ('completed' as const) : null,
      status: set.done ? ('completed' as const) : ('pending' as const),
      effort: null,
      completedAt: set.done ? performedAtIso : null,
      skippedReason: null,
    }));

    return {
      exerciseTemplateId: null,
      exerciseNameSnapshot: exercise.name.trim(),
      sets,
      tracked: exercise.trackedDefault,
      orderIndex,
      skipped: false,
      sessionInserted: true,
      status: sets.some((set) => set.status === 'completed') ? ('completed' as const) : ('active' as const),
      slotId: exercise.localKey,
      templateSlotId: null,
      templateExerciseId: null,
      notes: null,
      swappedFrom: null,
    };
  });
}

function isPrCard(card: WorkoutCompletionPrCard | null): card is WorkoutCompletionPrCard {
  return card !== null;
}

/**
 * Builds the save payload for a finished freestyle session: the template
 * draft persisted through upsertWorkoutTemplate and the completion summary
 * for the Workout Complete screen. Mirrors the editor's finish math so both
 * paths produce identical history entries.
 */
export function buildFreestyleFinish({
  exercises,
  workoutName,
  startedAtIso,
  performedAtIso,
  elapsedSeconds,
  exercisePrLookup,
}: FreestyleFinishInput): FreestyleFinishResult {
  const named = exercises.filter((exercise) => exercise.name.trim().length > 0);

  const exerciseCards: WorkoutCompletionExerciseCard[] = named.map((exercise) => ({
    id: exercise.localKey,
    name: exercise.name.trim(),
    imageUrl: exercise.imageUrl,
    completedSets: exercise.sets.filter((set) => set.done).length,
    totalSets: Math.max(1, exercise.sets.length),
    totalVolumeKg: exercise.sets.reduce((sum, set) => sum + setVolumeKg(set), 0),
    notes: null,
  }));

  const prCards: WorkoutCompletionPrCard[] = named
    .map((exercise): WorkoutCompletionPrCard | null => {
      const bestSet = exercise.sets.reduce<{
        estimatedOneRepMaxKg: number;
        performedWeightKg: number;
        performedReps: number;
      } | null>((best, set) => {
        if (!set.done) {
          return best;
        }

        const weightKg = parseNumberInput(set.kg);
        const reps = parseNumberInput(set.reps);
        if (weightKg === null || reps === null) {
          return best;
        }

        const estimate = estimateOneRepMaxKg(weightKg, reps);
        if (estimate === null) {
          return best;
        }

        if (!best || estimate > best.estimatedOneRepMaxKg) {
          return {
            estimatedOneRepMaxKg: estimate,
            performedWeightKg: weightKg,
            performedReps: reps,
          };
        }

        return best;
      }, null);

      if (!bestSet) {
        return null;
      }

      const previousBestOneRepMaxKg = resolvePreviousExercisePr({
        libraryItemId: exercise.libraryItemId,
        exerciseName: exercise.name,
        lookup: exercisePrLookup,
      });

      if (
        previousBestOneRepMaxKg !== null &&
        bestSet.estimatedOneRepMaxKg <= previousBestOneRepMaxKg + 0.05
      ) {
        return null;
      }

      return {
        id: `pr:${exercise.localKey}`,
        exerciseName: exercise.name.trim(),
        imageUrl: exercise.imageUrl,
        estimatedOneRepMaxKg: bestSet.estimatedOneRepMaxKg,
        previousBestOneRepMaxKg,
        performedWeightKg: bestSet.performedWeightKg,
        performedReps: bestSet.performedReps,
      };
    })
    .filter(isPrCard)
    .slice(0, 3);

  const persistedSessionName = buildPersistedSessionNames(
    [{ exerciseNames: named.map((exercise) => exercise.name) }],
    workoutName,
  )[0];

  return {
    draft: {
      name: workoutName,
      sessions: [
        {
          name: persistedSessionName,
          exercises: named.map((exercise) => ({
            name: exercise.name.trim(),
            targetSets: Math.max(1, exercise.sets.length),
            repMin: exercise.repMin,
            repMax: exercise.repMax,
            restSeconds: exercise.restSeconds > 0 ? Math.round(exercise.restSeconds) : null,
            trackedDefault: exercise.trackedDefault,
            libraryItemId: exercise.libraryItemId,
          })),
        },
      ],
    },
    summary: {
      workoutName,
      startedAt: startedAtIso,
      performedAt: performedAtIso,
      durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      setsCompleted: freestyleDoneSetCount(named),
      totalVolume: freestyleVolumeKg(named),
      exercisesLogged: named.length,
      exerciseCards,
      prCards,
      logs: buildLogDrafts(named, performedAtIso),
    },
  };
}

/**
 * What a set you have just added starts at.
 *
 * Blank, until now. In a free workout the second and third sets of a lift are
 * almost always the first one again — same bar, same reps — so the reader
 * retyped "60" and "6" for every one of them ("painot ja toistot
 * automaattisesti eli ylempänä 60kg ja 6toistoo tulisi alempaan kanssa 60kg
 * 6toistoo", #bugs 2026-08-28).
 *
 * The two numbers are carried INDEPENDENTLY, from the last set that has each.
 * A reader who logs the weight first and the reps after the set is mid-entry
 * on the row above; taking both from the same row would hand them a weight and
 * a blank, or nothing at all, depending on which half they had reached.
 *
 * A carried number is a suggestion, not a claim about what was lifted: it goes
 * into the draft text the same way a typed one does, and the set counts as
 * done only when the reader says so.
 */
export function carryForwardFreestyleSet(
  sets: ReadonlyArray<Pick<FreestyleSetDraft, 'kg' | 'reps'>>,
): { kg: string; reps: string } {
  const lastFilled = (read: (set: Pick<FreestyleSetDraft, 'kg' | 'reps'>) => string) => {
    for (let index = sets.length - 1; index >= 0; index -= 1) {
      const value = read(sets[index]);
      if (value.trim() !== '') {
        return value;
      }
    }
    return '';
  };

  return { kg: lastFilled((set) => set.kg), reps: lastFilled((set) => set.reps) };
}
