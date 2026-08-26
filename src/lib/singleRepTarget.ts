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

/**
 * The off-phase length an interval exercise states in its own name, or null
 * for everything that is not one.
 *
 * "Treadmill HIIT (30s on / 30s off)" means 30 seconds of work and 30
 * seconds of recovery, continuously — the walk IS the rest. A saved
 * programme carried a 45-60 s rest on top of it, so the player offered
 * "30 s kävelyä, 30 s juoksua, sitten minuutin tauko", which is not what
 * the name promises (user, 2026-08-26). The rest between interval reps is
 * exactly the named off-phase, nothing more.
 */
export function intervalOffSeconds(name: string): number | null {
  const match = /\/\s*(\d+)\s*s\s*(?:off|rest|walk)\b/i.exec(name);
  if (!match) {
    return null;
  }
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}
