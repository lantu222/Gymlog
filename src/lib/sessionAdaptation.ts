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
  /**
   * Slot ids left out of today's session.
   *
   * Same scope as a swap: an answer about today, spent when the session
   * starts, and never a change to the programme — the programme is edited from
   * its own page. A reader who cannot use one machine today should not have to
   * rewrite their plan to get past it.
   */
  drops: string[];
}

export const EMPTY_SESSION_ADAPTATION: SessionAdaptation = { swaps: {}, drops: [] };

export function hasSessionAdaptation(adaptation: SessionAdaptation | null | undefined): boolean {
  return Boolean(
    adaptation &&
      (Object.keys(adaptation.swaps).length > 0 || (adaptation.drops?.length ?? 0) > 0),
  );
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

  const dropped = new Set(adaptation.drops ?? []);
  const withoutDropped = dropped.size
    ? template.sessions.map((session) => ({
        ...session,
        exercises: session.exercises.filter((exercise) => !dropped.has(exercise.slotId)),
      }))
    : template.sessions;

  return {
    ...template,
    sessions: withoutDropped.map((session) => ({
      ...session,
      exercises: session.exercises.map((exercise) => {
        const swapName = adaptation.swaps[exercise.slotId];
        return swapName ? applySwap(exercise, swapName) : exercise;
      }),
    })),
  };
}


