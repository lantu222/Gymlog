/**
 * Which render failures came from the workout.
 *
 * The crash screen's "put the workout aside" helps only when the stored workout
 * bundle is what the app cannot draw. Offered after any repeated crash, it took
 * the workout in progress out of sight over a failure somewhere else, which it
 * could not cure (bug hunt 5; user decision 2026-10-03: offer it only when the
 * crash happened on the workout screen or while the workout data was loaded).
 *
 * So a failure is marked where the workout is: thrown while drawing a screen of
 * the workout tab (WorkoutAreaBoundary), or while the workout provider applied
 * an action to its state — loading the stored bundle is one, `session/hydrate` —
 * or read its summary (WorkoutProvider). The root boundary asks isWorkoutFailure.
 * Home also draws a little of the workout (its card); a crash there is not
 * marked, and "Try again" stays.
 *
 * A WeakSet of the thrown objects, not a flag: a flag set by one failure would
 * still be set when an unrelated one arrives. A thrown primitive (a string)
 * cannot be held, and is not marked.
 */
const fromWorkout = new WeakSet<object>();

const holdable = (error: unknown): error is object =>
  (typeof error === 'object' && error !== null) || typeof error === 'function';

export function markWorkoutFailure(error: unknown): void {
  if (holdable(error)) {
    fromWorkout.add(error);
  }
}

export function isWorkoutFailure(error: unknown): boolean {
  return holdable(error) && fromWorkout.has(error);
}

/** Runs `run`, marking anything it throws as the workout's, and throws it on. */
export function markingWorkoutFailures<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    markWorkoutFailure(error);
    throw error;
  }
}
