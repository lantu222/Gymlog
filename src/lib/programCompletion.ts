import { WorkoutTemplateV1 } from '../features/workout/workoutTypes';
import { WorkoutSession } from '../types/models';

import { resolveProgramAffinity } from './programAffinity';

/**
 * The moment a program is finished — which, until now, did not exist.
 *
 * The pieces around it all stop one step short: homePlanProgress freezes the
 * final week at "Viikko 8 / 8" and 100 %, the rotation in dashboard.ts picks
 * `(latest + 1) % entries.length` so session 33 is Day 1 again, and nothing
 * anywhere says "you finished". The reader who completes an 8-week block is
 * offered the same block forever, indistinguishable from week one.
 *
 * This module is the missing decision, kept pure so the rule is testable.
 * Rendering it is Home's job; persisting the dismissal is the caller's.
 */

export interface CompletionCardInput {
  /** The active plan's id — the dismissal key. */
  planId: string;
  /** Sessions logged against the plan, from the same count the hero shows. */
  sessionsDone: number;
  /** Planned total (sessions per week × weeks), from homePlanProgress. */
  sessionsTotal: number;
  /** The active program's template, for finding the step up. Null for plans
   * with no catalog template (freestyle weeks), which cannot complete. */
  activeTemplate: WorkoutTemplateV1 | null;
  catalog: readonly WorkoutTemplateV1[];
  /** Plan ids whose completion card the reader has already answered. */
  dismissedPlanIds: readonly string[];
}

export interface CompletionCard {
  planId: string;
  sessionsTotal: number;
  /**
   * The same-goal, one-level-up neighbour — resolveProgramAffinity's
   * `nextLevel` reason, surfaced at the one moment it is most worth saying.
   * Null when the finished program is already the top of its family; the card
   * then offers only a new round, rather than inventing a step that does not
   * exist.
   */
  nextLevelTemplateId: string | null;
}

/**
 * A plan is complete when the planned total is real and reached. `total > 0`
 * matters: a freestyle plan reports 0 planned sessions, and 0 >= 0 would
 * declare every empty plan finished on install day.
 */
export function isPlanComplete(sessionsDone: number, sessionsTotal: number): boolean {
  return sessionsTotal > 0 && sessionsDone >= sessionsTotal;
}

/**
 * The completion card to show on Home, or null.
 *
 * Null on dismissal rather than on any timer: the card stays until the reader
 * answers it (next program, new round, or explicitly put it away). A card that
 * disappears on its own turns the biggest moment the app has into something
 * you can miss by opening the app on the wrong day.
 */
export function resolveCompletionCard(input: CompletionCardInput): CompletionCard | null {
  if (!isPlanComplete(input.sessionsDone, input.sessionsTotal)) {
    return null;
  }
  if (input.dismissedPlanIds.includes(input.planId)) {
    return null;
  }

  const nextLevel =
    resolveProgramAffinity(input.activeTemplate, input.catalog).find(
      (match) => match.reason === 'nextLevel',
    ) ?? null;

  return {
    planId: input.planId,
    sessionsTotal: input.sessionsTotal,
    nextLevelTemplateId: nextLevel?.templateId ?? null,
  };
}

/**
 * Sessions logged against the plan's templates since a boundary — the count a
 * restarted plan begins from.
 *
 * Today the hero counts every session ever logged against the plan's
 * templates, which is correct for a first run and exactly wrong after "Uusi
 * kierros": the restarted plan would be born complete. The boundary is the
 * plan record's `updatedAt`, which re-adoption refreshes.
 */
export function countSessionsSince(
  sessions: readonly WorkoutSession[],
  templateIds: ReadonlySet<string>,
  sinceIso: string,
): number {
  const since = Date.parse(sinceIso);
  if (!Number.isFinite(since)) {
    // An unreadable boundary must not silently mean "count everything" — that
    // is the exact bug this function exists to prevent.
    return 0;
  }
  let count = 0;
  for (const session of sessions) {
    if (!session.workoutTemplateId || !templateIds.has(session.workoutTemplateId)) {
      continue;
    }
    const stamp = Date.parse(session.performedAt);
    if (Number.isFinite(stamp) && stamp >= since) {
      count += 1;
    }
  }
  return count;
}

/**
 * Sessions logged against the plan's templates inside one window — the count
 * behind "VIIKKO 1 · 2/2".
 *
 * Reported from the phone: two freestyle workouts filled week 1 of a programme
 * neither of them belonged to, and the green bar went full. The counter was
 * reading every session in the week, which is the right rule for a streak and
 * the wrong one for a plan: the label names the *programme's* week and the
 * denominator is the programme's days, so the numerator has to be the
 * programme's sessions.
 *
 * Same membership test as countSessionsSince, deliberately — a session belongs
 * to the plan when it was logged against one of the plan's templates, and a
 * freestyle session is saved against a template of its own. Two counters
 * disagreeing about what "a session of this plan" means is how "2/2" appeared
 * beside a plan with nothing done.
 */
export function countPlanSessionsInRange(
  sessions: readonly WorkoutSession[],
  templateIds: ReadonlySet<string>,
  fromMs: number,
  toMs: number,
): number {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return 0;
  }
  let count = 0;
  for (const session of sessions) {
    if (!session.workoutTemplateId || !templateIds.has(session.workoutTemplateId)) {
      continue;
    }
    const stamp = Date.parse(session.performedAt);
    if (Number.isFinite(stamp) && stamp >= fromMs && stamp < toMs) {
      count += 1;
    }
  }
  return count;
}
