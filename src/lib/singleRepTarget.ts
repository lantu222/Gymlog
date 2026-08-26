import { isHoldExerciseName } from './holdExercises';

/**
 * One rep number per exercise, for SAVED programs too.
 *
 * The catalogs collapsed every "8-10" to "10" on 2026-08-25 (repsMax kept,
 * because the progression gate always measured readiness against it). A
 * programme saved to the reader's own database before that day still carried
 * its ranges — the user asked for the same rule there (2026-08-26). This runs
 * in the load-time normalization, so every stored programme reads the same
 * way the catalog now writes.
 *
 * Holds are exempt for the same reason they were in the catalog: their
 * numbers are seconds, and "30-60 s" is a dose bracket, not a rep range.
 * `isHoldExerciseName` is the one list that decides.
 */
export function collapseRepRange(exercise: {
  name: string;
  repMin: number;
  repMax: number;
}): { repMin: number; repMax: number } {
  if (exercise.repMin === exercise.repMax || isHoldExerciseName(exercise.name)) {
    return { repMin: exercise.repMin, repMax: exercise.repMax };
  }
  return { repMin: exercise.repMax, repMax: exercise.repMax };
}
