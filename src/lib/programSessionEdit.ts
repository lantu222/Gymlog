/**
 * One edit to what a programme's day holds — drop a lift, swap a lift, add
 * lifts from the library — as a pure transform over the days themselves.
 *
 * This used to live inline in the App.tsx handler, next to the code that read
 * the days out of React state and the code that wrote them back. That is the
 * shape the data-loss bug hid in: a read half and a write half with a render
 * between them. Pulling the transform out leaves the caller with nothing but
 * "read fresh, transform, write" — and makes the transform the thing a test
 * can hold still, including the property that matters most here, that two
 * edits in a row compose instead of replacing each other.
 */

/** Only the fields an edit reads. The stored row carries more. */
export interface ProgramSessionExerciseSnapshot {
  id: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number | null;
  trackedDefault: boolean;
  libraryItemId?: string | null;
}

export interface ProgramSessionSnapshot {
  id: string;
  name: string;
  exercises: ReadonlyArray<ProgramSessionExerciseSnapshot>;
}

/** What the template writer takes back: the whole programme, every day. */
export interface ProgramSessionDayDraft {
  id: string;
  name: string;
  exercises: Array<{
    id: string;
    name: string;
    targetSets: number;
    repMin: number;
    repMax: number;
    restSeconds: number | null;
    trackedDefault: boolean;
    libraryItemId: string | null;
  }>;
}

/**
 * The numbers on the row: "5 × 12", and the rest between sets.
 *
 * Rest is nullable because the stored draft's is: an exercise added before
 * rest was recorded carries none, and a stepper cannot step a number that is
 * not there. Null means "do not touch the stored value" on the way back in.
 */
export interface ProgramPrescription {
  targetSets: number;
  repMin: number;
  repMax: number;
  restSeconds: number | null;
}

/**
 * Bounds, not preferences.
 *
 * These are the numbers a stepper is allowed to reach, and they exist because
 * a held "+" on a phone runs faster than the eye: without a ceiling the row
 * reads "97 × 300" and the session estimate behind it turns into a working
 * day. The floor is the same argument from the other side — zero sets is a
 * lift that is in the programme and never done.
 */
export const PROGRAM_SETS_RANGE = { min: 1, max: 12 } as const;
export const PROGRAM_REPS_RANGE = { min: 1, max: 50 } as const;
/**
 * Steps of 15 s rather than the design's 30, because the catalogue's own
 * rests are not multiples of 30 — 45 and 75 are everywhere — and a stepper
 * whose first press snaps a stored value to a grid has edited more than the
 * reader asked it to.
 */
export const PROGRAM_REST_RANGE = { min: 15, max: 480, step: 15 } as const;

/**
 * One press of one stepper.
 *
 * Reps move as a block. The catalog writes ranges — "3 × 6–8" is a real row,
 * and the span between the ends is the programme saying "stop when form goes",
 * not an accident of two numbers. Adding a rep to a range therefore gives
 * "7–9", and the step is refused outright when either end would leave the
 * bounds, so the span can never be silently squeezed flat by a stepper that
 * clamped one end and not the other.
 */
export function stepProgramPrescription(
  current: ProgramPrescription,
  field: 'sets' | 'reps' | 'rest',
  direction: 1 | -1,
): ProgramPrescription {
  if (field === 'sets') {
    const targetSets = current.targetSets + direction;
    if (targetSets < PROGRAM_SETS_RANGE.min || targetSets > PROGRAM_SETS_RANGE.max) {
      return current;
    }
    return { ...current, targetSets };
  }

  if (field === 'rest') {
    // A rest that was never recorded cannot be stepped: there is no number
    // for the press to be relative to, and inventing one here would write it.
    if (current.restSeconds === null) {
      return current;
    }
    const restSeconds = current.restSeconds + direction * PROGRAM_REST_RANGE.step;
    if (restSeconds < PROGRAM_REST_RANGE.min || restSeconds > PROGRAM_REST_RANGE.max) {
      return current;
    }
    return { ...current, restSeconds };
  }

  const repMin = current.repMin + direction;
  const repMax = current.repMax + direction;
  if (repMin < PROGRAM_REPS_RANGE.min || repMax > PROGRAM_REPS_RANGE.max) {
    return current;
  }
  return { ...current, repMin, repMax };
}

/** True while the stepper still has somewhere to go — what greys the button out. */
export function canStepProgramPrescription(
  current: ProgramPrescription,
  field: 'sets' | 'reps' | 'rest',
  direction: 1 | -1,
): boolean {
  const next = stepProgramPrescription(current, field, direction);
  return next !== current;
}

export type ProgramSessionEdit =
  | { kind: 'remove'; exerciseId: string }
  | { kind: 'replace'; exerciseId: string; exerciseName: string; libraryItemId: string | null }
  | { kind: 'add'; exercises: ReadonlyArray<ProgramSessionExerciseSnapshot> }
  /** The dose: how many sets, how many reps. Everything else about the row stays. */
  | { kind: 'prescribe'; exerciseId: string; prescription: ProgramPrescription }
  /**
   * Dropped where the drag let go — the whole journey as ONE edit.
   *
   * This replaced per-step "move up/down": a drag of three places written as
   * three moves is three reads and three writes through the queue, and on a
   * ready programme the first step forks the copy while the other two race
   * it. One edit carries the destination, and the fork happens once.
   */
  | { kind: 'reorder'; exerciseId: string; toIndex: number };

export type ProgramSessionEditOutcome =
  | { kind: 'save'; sessions: ProgramSessionDayDraft[] }
  /**
   * A day with nothing left in it is not a day: Home would draw a session card
   * with no session behind it, and starting it would open an empty player.
   * Deleting the day is a different decision, made in the editor.
   */
  | { kind: 'skip'; reason: 'lastExerciseInDay' }
  /**
   * The top row has no row above it. Writing the programme back unchanged
   * would be a save with nothing in it, and the reader would watch a
   * confirmation for an edit that never happened.
   */
  | { kind: 'skip'; reason: 'alreadyAtEdge' }
  | { kind: 'skip'; reason: 'exerciseMissing' };

function toDraftExercise(
  exercise: ProgramSessionExerciseSnapshot,
): ProgramSessionDayDraft['exercises'][number] {
  return {
    id: exercise.id,
    name: exercise.name,
    targetSets: exercise.targetSets,
    repMin: exercise.repMin,
    repMax: exercise.repMax,
    restSeconds: exercise.restSeconds,
    trackedDefault: exercise.trackedDefault,
    libraryItemId: exercise.libraryItemId ?? null,
  };
}

/**
 * Apply one edit to one day, and carry every other day through untouched.
 *
 * The whole programme comes back because the template is stored as a whole:
 * the days this edit does not name still have to be written out, or writing
 * the one day would delete the rest.
 */
export function applyProgramSessionEdit(
  sessions: ReadonlyArray<ProgramSessionSnapshot>,
  sessionId: string,
  edit: ProgramSessionEdit,
): ProgramSessionEditOutcome {
  // Answered before the programme is rebuilt: a drop that changes nothing
  // must not come back as a save, or the screen confirms an edit it did not
  // make. The destination is clamped rather than refused — a finger that
  // overshoots the list still means "last".
  if (edit.kind === 'reorder') {
    const day = sessions.find((session) => session.id === sessionId);
    const from = day?.exercises.findIndex((exercise) => exercise.id === edit.exerciseId) ?? -1;
    if (!day || from === -1) {
      return { kind: 'skip', reason: 'exerciseMissing' };
    }
    const to = Math.max(0, Math.min(day.exercises.length - 1, Math.round(edit.toIndex)));
    if (to === from) {
      return { kind: 'skip', reason: 'alreadyAtEdge' };
    }
  }

  const next: ProgramSessionDayDraft[] = sessions.map((session) => {
    const isTargetDay = session.id === sessionId;
    const exercises = session.exercises
      .filter((exercise) => !(isTargetDay && edit.kind === 'remove' && exercise.id === edit.exerciseId))
      .map((exercise) => {
        const rewrites = edit.kind === 'replace' || edit.kind === 'prescribe';
        if (!isTargetDay || !rewrites || exercise.id !== edit.exerciseId) {
          return toDraftExercise(exercise);
        }
        if (edit.kind === 'replace') {
          // Only the lift changes. Sets, reps and rest are the prescription,
          // and a swap is a different way to train it, not a different dose.
          return {
            ...toDraftExercise(exercise),
            name: edit.exerciseName,
            libraryItemId: edit.libraryItemId,
          };
        }
        if (edit.kind === 'prescribe') {
          // The mirror image of a swap: the dose changes, the lift does not.
          // Rest rides along only when the sheet had a number to step — null
          // means the stored value, whatever it is, stays untouched.
          return {
            ...toDraftExercise(exercise),
            targetSets: edit.prescription.targetSets,
            repMin: edit.prescription.repMin,
            repMax: edit.prescription.repMax,
            ...(typeof edit.prescription.restSeconds === 'number'
              ? { restSeconds: edit.prescription.restSeconds }
              : {}),
          };
        }
        return toDraftExercise(exercise);
      });

    if (isTargetDay && edit.kind === 'reorder') {
      const from = exercises.findIndex((exercise) => exercise.id === edit.exerciseId);
      const to = Math.max(0, Math.min(exercises.length - 1, Math.round(edit.toIndex)));
      // Lifted out and put back where the drag let go, so the rows between it
      // and its destination close up behind it rather than swapping
      // identities.
      const [moved] = exercises.splice(from, 1);
      exercises.splice(to, 0, moved);
    }

    return {
      id: session.id,
      name: session.name,
      exercises:
        isTargetDay && edit.kind === 'add'
          ? // Added at the end of the day it was added from, and nowhere else.
            [...exercises, ...edit.exercises.map(toDraftExercise)]
          : exercises,
    };
  });

  if (next.find((session) => session.id === sessionId)?.exercises.length === 0) {
    return { kind: 'skip', reason: 'lastExerciseInDay' };
  }

  return { kind: 'save', sessions: next };
}
