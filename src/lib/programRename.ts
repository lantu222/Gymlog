import { WorkoutPlan } from '../types/models';

/**
 * Renaming a programme renames the plans built on it.
 *
 * A `WorkoutPlan` carries its own `name`, copied from the template the moment
 * the plan was made (`buildProgramWorkoutPlan`'s `programName`). That is a
 * second copy of one fact, and Home reads the plan's copy first —
 * `activeWorkoutPlan.name || activeTemplate.name` — so renaming the template
 * alone changed the programme page and left Home saying the old name (user
 * 2026-09-08, "pystyy kirjoittamaan ja tallentamaan mutta se ei tallenna
 * nimeä home screenissä").
 *
 * The two truths are not merged here: a plan's name is what a reader saw when
 * they started it, and other surfaces read it. They are kept in step instead,
 * in the one place that renames a programme, so no screen can disagree with
 * another about what the reader just typed.
 *
 * A plan belongs to the template when any of its entries points at it. Plans
 * that do not are returned untouched, and so is the array itself when nothing
 * matched — the provider commits only when something actually changed.
 *
 * `updatedAt` is deliberately NOT touched. On a plan it is not a modification
 * timestamp: it is the block boundary. Home counts the week from it —
 * `countSessionsSince(completedPlanSessions, planTemplateIds, plan.updatedAt)`
 * — because plan records are written only at onboarding, adoption and restart,
 * which is also what makes "Uusi kierros" possible at all. Stamping it here
 * would have reset a reader's week and session count to zero for typing a new
 * name, with every completed session still in the database and nothing on
 * screen to explain it (review, PR #85). Moving days already refuses to touch
 * it for the same reason; so does a rename.
 */
export function renamePlansForTemplate(
  plans: readonly WorkoutPlan[],
  workoutTemplateId: string,
  nextName: string,
): WorkoutPlan[] {
  return plans.map((plan) => {
    const belongs = plan.entries.some((entry) => entry.workoutTemplateId === workoutTemplateId);
    if (!belongs || plan.name === nextName) {
      return plan;
    }
    return { ...plan, name: nextName };
  });
}

/** Did anything actually change? Saves a commit that would write the same bytes. */
export function plansChanged(before: readonly WorkoutPlan[], after: readonly WorkoutPlan[]): boolean {
  return before.some((plan, index) => plan !== after[index]);
}
