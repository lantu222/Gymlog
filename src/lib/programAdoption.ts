import { WorkoutPlan } from '../types/models';

/**
 * Adopting a ready program as the reader's active plan.
 *
 * Until now the only code that ever set `preferences.activePlanId` lived in the
 * two onboarding finishes. Everything after onboarding could start a *session*
 * from a ready program, but nothing could make that program the plan Home reads
 * — so "Start season" on SeasonScreen opened the season's programme page and
 * stopped there, and a reader who had not happened to pick that exact programme
 * during onboarding could never join a season at all. Since season points only
 * count sessions from the season programme, the whole scoreboard was
 * unreachable.
 *
 * This module is the missing step, kept pure so the rule is testable: it builds
 * the plan record that makes adoption true. Whether adoption is allowed at all
 * is activeProgramSet's question.
 */

export interface ReadyProgramPlanInput {
  workoutTemplateId: string;
  /** Shown on Home as the active plan's name. */
  programName: string;
  /** Session ids in the order they should be trained. */
  sessionIds: string[];
  /**
   * Weekday labels to hang the sessions on. When empty the entries fall back to
   * "Day N" rather than inventing a weekday the reader never chose.
   */
  dayLabels: string[];
  /** ISO timestamp, injected so this stays pure and testable. */
  now: string;
}

/**
 * The plan id is derived from the template, not from the moment of adoption, so
 * re-joining the same programme updates one record instead of leaving a trail of
 * orphaned plans behind it.
 */
export function buildReadyProgramPlanId(workoutTemplateId: string): string {
  return `ready_plan_${workoutTemplateId}`;
}

export function buildReadyProgramWorkoutPlan(input: ReadyProgramPlanInput): WorkoutPlan {
  const planId = buildReadyProgramPlanId(input.workoutTemplateId);
  const entryCount = Math.max(1, input.sessionIds.length);

  return {
    id: planId,
    name: input.programName,
    mode: 'rotation',
    entries: Array.from({ length: entryCount }, (_, index) => ({
      id: `${planId}_entry_${index + 1}`,
      workoutTemplateId: input.workoutTemplateId,
      workoutTemplateSessionId: input.sessionIds[index] ?? null,
      label: input.dayLabels.length > 0
        ? input.dayLabels[index % input.dayLabels.length]
        : `Day ${index + 1}`,
      orderIndex: index,
    })),
    isActive: true,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
