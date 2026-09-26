/**
 * Pure domain logic for the freestyle Empty Workout screen (HG redesign).
 *
 * The screen keeps a small local draft state (exercises + typed sets); this
 * module owns everything derivable from it: the add-sheet muscle filter, the
 * letter-tile initials, and the finish payload (template draft + completion
 * summary) handed to App.tsx on save.
 */
import { parseNumberInput } from './format';
import { REPS_DIAL } from './weightDial';
import { isLiftableWeight } from './weightLimits';
import { isExerciseDone } from './sessionTotals';
import { beatsBest, heaviestOfSets } from './personalRecords';
import {
  ExercisePrLookup,
  WorkoutCompletionExerciseCard,
  WorkoutCompletionPrCard,
  resolvePreviousExercisePr,
} from './workoutCompletionSummary';
import { buildPersistedSessionNames } from './workoutEditorNaming';
import { buildSupersetRuns, isSupersetLinked, normalizeSupersetGroups } from './supersetGrouping';
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
  /**
   * The superset this lift is part of — shared with the row below it when the
   * two are done back to back. Same field, same rule and same helpers as a
   * programme's day: see src/lib/supersetGrouping.ts.
   */
  supersetGroup?: string | null;
}

/** A lift as the screen holds it: the draft plus what it draws for it. */
export interface FreestyleExerciseSnapshot extends FreestyleExerciseDraft {
  displayName: string;
  initials: string;
  metaLabel: string;
  isBarbell: boolean;
}

/**
 * A freestyle session in flight, as the workout provider keeps it.
 *
 * The session used to live in the screen's React state alone: forty
 * minutes in, Android reclaiming the app for a camera or a call meant
 * reopening to an empty board with nothing to recover, while the guided
 * player had persisted every set (audit round 4, 2026-09-20). This is what
 * survives — the lifts with their rows, when the session started, and the
 * rest that was running.
 */
export interface FreestyleDraftSnapshot {
  exercises: FreestyleExerciseSnapshot[];
  startedAtMs: number | null;
  rest: { totalSeconds: number; endsAtMs: number; startedAtMs: number } | null;
  savedAtMs: number;
}

/**
 * How long a stored draft's clock stays the session's clock.
 *
 * Long enough to cover the thing the draft exists for — a process killed
 * mid-session, a phone left face down through a long rest, a night's sleep
 * with the app in the background — and short enough that a board found days
 * later is not still counting.
 */
export const FREESTYLE_DRAFT_CLOCK_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * When a resumed freestyle session started.
 *
 * The draft's own start, while the draft is fresh: that is the session the
 * reader is coming back to, and its clock has been running the whole time.
 *
 * A draft older than that is the same lifts and a NEW session. `savedAtMs`
 * was written on every save and read nowhere, so a board left on Friday and
 * reopened on Monday resumed with a header reading 72:14:03 and saved a
 * session claiming 4 334 minutes, starting three days before the first set
 * of it was logged (CI review of #162). The rows are the reader's work and
 * they stay; the clock starts now.
 *
 * A `savedAtMs` in the future — the device clock moved back — is not fresh
 * either, for the same reason: nothing can be said about how long ago that
 * was.
 */
export function resolveFreestyleDraftStart(
  draft: { startedAtMs: number | null; savedAtMs: number } | null | undefined,
  now: number,
): number | null {
  if (!draft || draft.startedAtMs === null) {
    return null;
  }
  const age = now - draft.savedAtMs;
  return age >= 0 && age <= FREESTYLE_DRAFT_CLOCK_MAX_AGE_MS ? draft.startedAtMs : now;
}

const finiteOr = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * A stored snapshot, or null. Read from disk, so nothing in it is trusted:
 * a lift without a name or rows is dropped, a row without a key is
 * dropped, numbers that are not numbers become the defaults, and a
 * snapshot left with no lifts is no snapshot.
 */
export function normalizeFreestyleDraftSnapshot(input: unknown): FreestyleDraftSnapshot | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const raw = input as Record<string, unknown>;
  const exercises: FreestyleExerciseSnapshot[] = [];
  for (const item of Array.isArray(raw.exercises) ? raw.exercises : []) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const lift = item as Record<string, unknown>;
    if (typeof lift.localKey !== 'string' || !lift.localKey || typeof lift.name !== 'string' || !lift.name.trim()) {
      continue;
    }
    const sets: FreestyleSetDraft[] = [];
    for (const row of Array.isArray(lift.sets) ? lift.sets : []) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const set = row as Record<string, unknown>;
      if (typeof set.localKey !== 'string' || !set.localKey) {
        continue;
      }
      sets.push({
        localKey: set.localKey,
        kg: typeof set.kg === 'string' ? set.kg : '',
        reps: typeof set.reps === 'string' ? set.reps : '',
        done: set.done === true,
      });
    }
    if (sets.length === 0) {
      continue;
    }
    const displayName = typeof lift.displayName === 'string' && lift.displayName ? lift.displayName : lift.name;
    exercises.push({
      localKey: lift.localKey,
      name: lift.name,
      libraryItemId: typeof lift.libraryItemId === 'string' ? lift.libraryItemId : null,
      imageUrl: typeof lift.imageUrl === 'string' ? lift.imageUrl : null,
      repMin: finiteOr(lift.repMin, 8),
      repMax: finiteOr(lift.repMax, 12),
      restSeconds: finiteOr(lift.restSeconds, 90),
      trackedDefault: lift.trackedDefault !== false,
      sets,
      supersetGroup: typeof lift.supersetGroup === 'string' ? lift.supersetGroup : null,
      displayName,
      initials: typeof lift.initials === 'string' ? lift.initials : displayName.slice(0, 2).toUpperCase(),
      metaLabel: typeof lift.metaLabel === 'string' ? lift.metaLabel : '',
      isBarbell: lift.isBarbell === true,
    });
  }
  if (exercises.length === 0) {
    return null;
  }
  const restRaw = raw.rest && typeof raw.rest === 'object' ? (raw.rest as Record<string, unknown>) : null;
  const rest =
    restRaw &&
    typeof restRaw.endsAtMs === 'number' &&
    Number.isFinite(restRaw.endsAtMs) &&
    typeof restRaw.startedAtMs === 'number' &&
    Number.isFinite(restRaw.startedAtMs)
      ? {
          totalSeconds: Math.max(1, Math.round(finiteOr(restRaw.totalSeconds, 60))),
          endsAtMs: restRaw.endsAtMs,
          startedAtMs: restRaw.startedAtMs,
        }
      : null;
  return {
    exercises,
    startedAtMs: typeof raw.startedAtMs === 'number' && Number.isFinite(raw.startedAtMs) ? raw.startedAtMs : null,
    rest,
    savedAtMs: finiteOr(raw.savedAtMs, 0),
  };
}

export interface FreestyleFinishInput {
  exercises: FreestyleExerciseDraft[];
  workoutName: string;
  startedAtIso: string;
  performedAtIso: string;
  elapsedSeconds: number;
  exercisePrLookup: ExercisePrLookup;
}

/** What a finished freestyle session hands to the save. */
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

/**
 * Whether a typed set can be ticked done: its weight is one a person could
 * lift and its reps fit the reps dial. Empty fields are allowed — the finish
 * decides what an empty set means.
 *
 * The fields took anything. "825" for 82,5 was ticked, counted into volume and
 * shown on the summary, and then the loader dropped the set on the next launch
 * because nothing over the ceiling is a set.
 *
 * Reps are whole. "8,5" was ticked and stored as 8.5 reps — into volume, a PR
 * card and the history line (decimal audit, 2026-09-21); the guided dials round,
 * and a field cannot round without saying so, so it refuses like a typo.
 */
export function isLoggableFreestyleSet(set: Pick<FreestyleSetDraft, 'kg' | 'reps'>): boolean {
  const kg = set.kg.trim() ? parseNumberInput(set.kg) : null;
  const reps = set.reps.trim() ? parseNumberInput(set.reps) : null;
  if (set.kg.trim() && !isLiftableWeight(kg)) {
    return false;
  }
  if (set.reps.trim() && (reps === null || reps < 0 || reps > REPS_DIAL.max || !Number.isInteger(reps))) {
    return false;
  }
  return true;
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
  /**
   * The whole list, so this can see whether the lift runs into the next one.
   * Optional because the rule below it — un-ticking, and an uncountable rest —
   * needs nothing but the lift itself.
   */
  exercises: ReadonlyArray<FreestyleExerciseDraft> = [],
): number | null {
  // Un-ticking corrects a mistake; it is not the end of a set. The caller
  // hands over the PRE-toggle set, so this is the one rule about which way
  // the tick is going, and it lives here rather than at the call site.
  if (set.done) {
    return null;
  }

  const index = exercises.findIndex((entry) => entry.localKey === exercise.localKey);
  const group = index === -1 ? [] : supersetGroupMembers(exercises, index);

  // A superset's whole point: A1 runs straight into A2, so ticking A1 starts
  // nothing. The rest belongs after the last lift of the group.
  if (group.length > 1 && index < exercises.length - 1 && isSupersetLinked(exercises, index)) {
    return null;
  }

  // Nothing below a second is a rest. Both numbers can arrive unusable — a
  // stored preference reaches getExerciseTemplateDefaults unbounded, and NaN
  // survives every arithmetic step to produce a bar frozen at 0:00 that never
  // ends. A rest that cannot be counted is not started.
  //
  // A superset rests as long as its most demanding lift asks for: a squat
  // paired with a curl is still a squat.
  const own = Math.round(
    group.length > 1
      ? group.reduce((longest, member) => Math.max(longest, member.restSeconds), 0)
      : exercise.restSeconds,
  );
  const seconds = own > 0 ? own : Math.round(defaultRestSeconds);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** The lifts performed as one superset with the one at `index`, itself included. */
function supersetGroupMembers(
  exercises: ReadonlyArray<FreestyleExerciseDraft>,
  index: number,
): FreestyleExerciseDraft[] {
  const run = buildSupersetRuns(normalizeSupersetGroups(exercises)).find((candidate) =>
    candidate.indexes.includes(index),
  );
  return run ? run.indexes.map((member) => exercises[member]) : [];
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

/**
 * Whether a freestyle session has anything to save (user decision,
 * 2026-09-26): at least one set ticked done.
 *
 * Finish used to ask only "is there a lift on the board?" — a board with rows
 * typed in and nothing ticked still saved, as a template with a session
 * nobody performed and a history entry of zero completed sets. A free
 * workout with nothing done is not a workout; it is the board the reader
 * meant to fill in and left.
 */
export function canFinishFreestyleSession(exercises: FreestyleExerciseDraft[]): boolean {
  return freestyleDoneSetCount(exercises) > 0;
}

/**
 * What leaving would throw away: sets ticked, and sets with a number in them
 * that were not ticked yet.
 *
 * The leave question counted only ticked sets, so four sets with their
 * weights and reps typed in and the tick still to come went on one tap of
 * back, with nothing asked. A new exercise starts with an empty set and a new
 * set carries only what the reader typed above it, so a number in a draft is
 * the reader's own.
 */
export function freestyleUnsavedWork(exercises: FreestyleExerciseDraft[]): {
  doneSets: number;
  enteredSets: number;
} {
  let doneSets = 0;
  let enteredSets = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.done) {
        doneSets += 1;
      } else if (set.kg.trim() !== '' || set.reps.trim() !== '') {
        enteredSets += 1;
      }
    }
  }
  return { doneSets, enteredSets };
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
      const doneSets = exercise.sets
        .filter((set) => set.done)
        .map((set) => ({ weight: parseNumberInput(set.kg), reps: parseNumberInput(set.reps) }))
        .filter((set): set is { weight: number; reps: number } => set.weight !== null && set.reps !== null);
      const bestSet = heaviestOfSets(doneSets);

      if (!bestSet) {
        return null;
      }

      const previousBest = resolvePreviousExercisePr({
        libraryItemId: exercise.libraryItemId,
        exerciseName: exercise.name,
        lookup: exercisePrLookup,
      });

      // Beaten, not matched: heavier, or the same weight for more reps.
      if (!beatsBest(bestSet, previousBest)) {
        return null;
      }

      return {
        id: `pr:${exercise.localKey}`,
        exerciseName: exercise.name.trim(),
        imageUrl: exercise.imageUrl,
        previousBestWeightKg: previousBest?.weight ?? null,
        previousBestReps: previousBest?.reps ?? null,
        performedWeightKg: bestSet.weight,
        performedReps: bestSet.reps,
      };
    })
    .filter(isPrCard)
    .slice(0, 3);

  const persistedSessionName = buildPersistedSessionNames(
    [{ exerciseNames: named.map((exercise) => exercise.name) }],
    workoutName,
  )[0];
  const logs = buildLogDrafts(named, performedAtIso);

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
            // A free workout is saved as a template, and a superset performed
            // in it is part of how that workout was done — dropping it here
            // would make the saved copy a different session.
            supersetGroup: exercise.supersetGroup ?? null,
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
      // The lifts done, off the logs this save writes and by the rule History
      // reads them with. Every named row used to count, so a lift typed in and
      // never ticked made "2 LIIKETTÄ" of a session that had one.
      exercisesLogged: logs.filter(isExerciseDone).length,
      exerciseCards,
      prCards,
      logs,
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
