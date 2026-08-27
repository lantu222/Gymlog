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

export type ProgramSessionEdit =
  | { kind: 'remove'; exerciseId: string }
  | { kind: 'replace'; exerciseId: string; exerciseName: string; libraryItemId: string | null }
  | { kind: 'add'; exercises: ReadonlyArray<ProgramSessionExerciseSnapshot> };

export type ProgramSessionEditOutcome =
  | { kind: 'save'; sessions: ProgramSessionDayDraft[] }
  /**
   * A day with nothing left in it is not a day: Home would draw a session card
   * with no session behind it, and starting it would open an empty player.
   * Deleting the day is a different decision, made in the editor.
   */
  | { kind: 'skip'; reason: 'lastExerciseInDay' };

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
  const next: ProgramSessionDayDraft[] = sessions.map((session) => {
    const isTargetDay = session.id === sessionId;
    const exercises = session.exercises
      .filter((exercise) => !(isTargetDay && edit.kind === 'remove' && exercise.id === edit.exerciseId))
      .map((exercise) => {
        const isTargetRow = isTargetDay && edit.kind === 'replace' && exercise.id === edit.exerciseId;
        if (!isTargetRow) {
          return toDraftExercise(exercise);
        }
        // Only the lift changes. Sets, reps and rest are the prescription, and
        // a swap is a different way to train it, not a different dose.
        return {
          ...toDraftExercise(exercise),
          name: edit.exerciseName,
          libraryItemId: edit.libraryItemId,
        };
      });

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
