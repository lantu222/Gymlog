/**
 * How long a session takes — one formula, so every screen quotes the same
 * number.
 *
 * There were four answers to this question. The catalog carried a hand-written
 * `estimatedSessionDuration` per program; Home guessed `exercises × 10 min` for
 * custom programs; the guided entry added up its own steps at a flat 35 s per
 * set; and the Adapt sheet subtracted 5 min per dropped set from whichever of
 * those it had been handed. They disagreed in public — the Adapt sheet promised
 * "~35 min" and the very next screen said "~50 min" for the same session.
 *
 * The model, deliberately simple enough to be argued with:
 *
 *   set  = reps × SECONDS_PER_REP + SET_SETUP_SECONDS
 *   rest = the exercise's own prescribed rest, after every set but the last
 *   plus the warm-up and cool-down as prescribed, and a short setup per
 *   exercise for walking over and loading the bar
 *
 * At 10 reps a set works out at about a minute of work, which is the rule of
 * thumb this replaces — but it now scales with the prescription, so a set of 5
 * and a set of 15 stop costing the same.
 *
 * It is an estimate and says so with a "~". What it must not do is be a
 * different estimate on the next screen.
 */

/** A controlled working rep, eccentric included. */
export const SECONDS_PER_REP = 3.5;
/** Unracking, breathing, getting set — per working set. */
export const SET_SETUP_SECONDS = 20;
/** Walking over, loading the bar, first setup — per exercise. */
export const EXERCISE_SETUP_SECONDS = 45;

export interface DurationExerciseInput {
  sets: number;
  /** The top of the prescribed rep range — what the session is planned for. */
  reps: number;
  /**
   * `reps` is seconds under tension, not repetitions (trackingMode 'hold').
   *
   * Without this a 60-second plank costs 60 × 3.5 s = three and a half
   * minutes of "work", and a mobility session quoted twice the time it takes.
   */
  timed?: boolean;
  /** Prescribed rest between sets, in seconds. */
  restSeconds: number;
  /** Skipped exercises cost nothing. */
  skipped?: boolean;
}

export interface SessionDurationInput {
  exercises: DurationExerciseInput[];
  /** Warm-up and cool-down as prescribed, in seconds. Zero when there is none. */
  warmupSeconds?: number;
  cooldownSeconds?: number;
}

export function estimateWorkingSetSeconds(reps: number, timed = false): number {
  const safeReps = Number.isFinite(reps) && reps > 0 ? reps : 8;
  // A held position already IS its duration; only the getting-into-it costs
  // extra. A rep count has to be multiplied out.
  return Math.round((timed ? safeReps : safeReps * SECONDS_PER_REP) + SET_SETUP_SECONDS);
}

export function estimateSessionSeconds(input: SessionDurationInput): number {
  const working = input.exercises.reduce((total, exercise) => {
    if (exercise.skipped || exercise.sets <= 0) {
      return total;
    }
    const setSeconds = estimateWorkingSetSeconds(exercise.reps, exercise.timed) * exercise.sets;
    // No rest is counted after the final set of an exercise: what follows is
    // the walk to the next one, which the setup cost already pays for.
    const restSeconds = Math.max(0, exercise.sets - 1) * Math.max(0, exercise.restSeconds);
    return total + EXERCISE_SETUP_SECONDS + setSeconds + restSeconds;
  }, 0);

  return working + Math.max(0, input.warmupSeconds ?? 0) + Math.max(0, input.cooldownSeconds ?? 0);
}

/**
 * Minutes, rounded to the nearest 5 — the precision the "~" is honest about.
 * A session with nothing in it is 0, not a rounded-up 5: an empty plan should
 * not claim to take time.
 */
export function estimateSessionMinutes(input: SessionDurationInput): number {
  const seconds = estimateSessionSeconds(input);
  if (seconds <= 0) {
    return 0;
  }
  return Math.max(5, Math.round(seconds / 60 / 5) * 5);
}
