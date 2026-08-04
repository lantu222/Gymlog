/**
 * Today's changes to today's session, decided before it starts.
 *
 * The Home screen lets you shorten the session and swap a lift out while you
 * are still looking at the plan. Neither can be written into a workout session,
 * because there is no session yet — so an adaptation is held for this start
 * only and applied to the runtime template on the way in. Both start paths
 * (ready program and custom program) funnel through the same
 * `startCustomWorkout(runtimeTemplate, …)` call, so one function applied there
 * covers both.
 *
 * It deliberately does not persist. An adaptation is an answer to "how is today
 * going", and a stale one is worse than none — if the session is not started,
 * the change goes away with it.
 *
 * What is NOT here, on purpose:
 * - Equipment substitution. A taken rack is discovered in the gym, not at home
 *   on the sofa; that is what the player's own swap is for.
 * - A load multiplier. Whether you have the strength for a weight is answered
 *   set by set, and the player's weight control does it in one tap — deciding
 *   it in advance for the whole session would be a guess about how you will
 *   feel in forty minutes.
 */

import { WorkoutRuntimeTemplate, WorkoutTemplateExercise } from '../features/workout/workoutTypes';
import { estimateSessionMinutes } from './sessionDuration';

export interface SessionAdaptation {
  /** Template slot id → the exercise name to do instead. */
  swaps: Record<string, string>;
  /** Trim the session's working sets, accessories first. */
  trimSets: boolean;
}

export const EMPTY_SESSION_ADAPTATION: SessionAdaptation = { swaps: {}, trimSets: false };

export function hasSessionAdaptation(adaptation: SessionAdaptation | null | undefined): boolean {
  return Boolean(adaptation && (adaptation.trimSets || Object.keys(adaptation.swaps).length > 0));
}

/** Same 30 % rule the Home copy quotes, so the promise and the act agree. */
export function getSessionTrimTarget(totalSets: number): number {
  return Math.max(1, Math.round(totalSets * 0.3));
}

interface TrimmableExercise {
  slotId: string;
  role: string;
  sets: number;
}

/**
 * How many sets each slot keeps after trimming.
 *
 * Takes from the back of the session and from the least important work first —
 * accessories, then secondaries — and never below one set, so nothing silently
 * disappears from the day. The primary lift is not touched at all: it is the
 * reason the session exists, and a "shorter" session that guts it is a
 * different session, not a shorter one.
 *
 * Returns the full slot → set-count map (unchanged slots included) so callers
 * can diff it without re-deriving the rule.
 */
export function planSessionTrim(
  exercises: TrimmableExercise[],
  targetDrop: number,
): Record<string, number> {
  const kept: Record<string, number> = {};
  exercises.forEach((exercise) => {
    kept[exercise.slotId] = exercise.sets;
  });

  let remaining = Math.max(0, targetDrop);
  if (remaining === 0) {
    return kept;
  }

  // Accessories before secondaries, and within a tier the later exercise goes
  // first — the end of a session is where the optional work lives.
  const order = ['accessory', 'secondary'];
  for (const role of order) {
    const candidates = exercises
      .map((exercise, index) => ({ exercise, index }))
      .filter((item) => item.exercise.role === role)
      .sort((left, right) => right.index - left.index);

    // One pass per round so a single long exercise is not stripped to the bone
    // while the one after it keeps everything.
    let tookSomething = true;
    while (remaining > 0 && tookSomething) {
      tookSomething = false;
      for (const { exercise } of candidates) {
        if (remaining === 0) {
          break;
        }
        if (kept[exercise.slotId] > 1) {
          kept[exercise.slotId] -= 1;
          remaining -= 1;
          tookSomething = true;
        }
      }
    }
    if (remaining === 0) {
      break;
    }
  }

  return kept;
}

/** Sets actually removed by a trim plan — what the confirmation may claim. */
export function countTrimmedSets(
  exercises: TrimmableExercise[],
  kept: Record<string, number>,
): number {
  return exercises.reduce((sum, exercise) => sum + (exercise.sets - (kept[exercise.slotId] ?? exercise.sets)), 0);
}

function applySwap(exercise: WorkoutTemplateExercise, name: string): WorkoutTemplateExercise {
  return { ...exercise, exerciseName: name };
}

/**
 * The adapted template to start from. Returns the input untouched when there is
 * nothing to apply, so the ordinary path allocates nothing.
 */
export function applySessionAdaptation(
  template: WorkoutRuntimeTemplate,
  adaptation: SessionAdaptation | null | undefined,
): WorkoutRuntimeTemplate {
  if (!hasSessionAdaptation(adaptation) || !adaptation) {
    return template;
  }

  const allExercises = template.sessions.flatMap((session) => session.exercises);
  const kept = adaptation.trimSets
    ? planSessionTrim(
        allExercises.map((exercise) => ({
          slotId: exercise.slotId,
          role: exercise.role,
          sets: exercise.sets,
        })),
        getSessionTrimTarget(allExercises.reduce((sum, exercise) => sum + exercise.sets, 0)),
      )
    : null;

  return {
    ...template,
    sessions: template.sessions.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => {
        const swapName = adaptation.swaps[exercise.slotId];
        const next = swapName ? applySwap(exercise, swapName) : exercise;
        const nextSets = kept?.[exercise.slotId];
        if (typeof nextSets !== 'number' || nextSets === exercise.sets) {
          return next;
        }
        return { ...next, sets: nextSets };
      }),
    })),
  };
}

export interface TrimPreviewExercise extends TrimmableExercise {
  /** Top of the prescribed rep range — what the duration formula plans for. */
  reps: number;
  restSeconds: number;
}

/**
 * What "Shorter session" would actually do, in the numbers the sheet quotes.
 *
 * The sheet used to promise sets rather than minutes, because the minute
 * figure came from a different estimator than the one the very next screen
 * showed — it subtracted a flat 5 min per dropped set, where the real formula
 * charges a set its own reps and its own rest. On a 90-second-rest accessory
 * that flat 5 was double.
 *
 * Now the preview runs the real trim plan through the real duration formula,
 * so the minutes on the sheet are the minutes the player will show. Sets stay
 * in the copy too: they are exact where the minutes are an estimate.
 */
export function previewSessionTrim(
  exercises: TrimPreviewExercise[],
  routine: { warmupSeconds?: number; cooldownSeconds?: number } = {},
): { droppedSets: number; minutes: number } {
  const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const kept = planSessionTrim(exercises, getSessionTrimTarget(totalSets));
  return {
    droppedSets: countTrimmedSets(exercises, kept),
    minutes: estimateSessionMinutes({
      exercises: exercises.map((exercise) => ({
        sets: kept[exercise.slotId] ?? exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
      })),
      ...routine,
    }),
  };
}
