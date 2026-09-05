/**
 * Loads no one could have lifted, taken out of a session that is still open.
 *
 * The completed side of this lives in `exerciseLog`, which drops such a set on
 * load, and it is not enough on its own: the 5122,5 kg sumo deadlift of
 * #bugs 2026-09-05 was sitting in a LIVE session, where a load is a dial value
 * rather than a logged set. Cleaning only the history would have let the reader
 * resume the workout and write the number straight back.
 */

import { parseNumberInput } from './format';
import { isLiftableWeight } from './weightLimits';
import type { WorkoutSessionRuntime, WorkoutSetInstance } from '../features/workout/workoutTypes';

/**
 * Does any load on this set describe a bar nobody could have held?
 *
 * `draftLoadText` counts, because it is what the dial reads on resume — the
 * numeric fields can be clean while the text still says 5122,5.
 */
export function setCarriesImpossibleLoad(set: WorkoutSetInstance): boolean {
  const drafted = parseNumberInput(set.draftLoadText);

  return (
    (set.plannedLoadKg !== undefined && !isLiftableWeight(set.plannedLoadKg)) ||
    (set.actualLoadKg !== undefined && !isLiftableWeight(set.actualLoadKg)) ||
    (set.autoProgressedFromKg !== undefined && !isLiftableWeight(set.autoProgressedFromKg)) ||
    (drafted !== null && !isLiftableWeight(drafted))
  );
}

/**
 * Every load on an affected set goes together — planned, drafted, actual and
 * the "we moved this up for you" marker — because they all describe one bar.
 * Keeping any one of them would leave the set arguing with itself.
 *
 * Sets and exercises that are already fine keep their identity: this runs on
 * every resume, and rebuilding the whole board each time would remount it.
 */
export function scrubImpossibleSessionLoads(session: WorkoutSessionRuntime): WorkoutSessionRuntime {
  let sessionChanged = false;

  const exercises = session.exercises.map((exercise) => {
    let exerciseChanged = false;

    const sets = exercise.sets.map((set) => {
      if (!setCarriesImpossibleLoad(set)) {
        return set;
      }

      exerciseChanged = true;
      sessionChanged = true;
      const { plannedLoadKg, actualLoadKg, autoProgressedFromKg, ...rest } = set;
      return { ...rest, draftLoadText: '' };
    });

    return exerciseChanged ? { ...exercise, sets } : exercise;
  });

  return sessionChanged ? { ...session, exercises } : session;
}
