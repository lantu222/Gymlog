/**
 * Which programmes are RUNNING, and which plans belong to each.
 *
 * "Running" and "leading" are two different questions, and the Programs tab
 * used to answer only the second: an adopted ready programme has no row in
 * `workoutTemplates` — adoption points a plan at the catalog rather than
 * copying it — so it appeared in "your programmes" only while Home led with
 * it. Making a second programme lead dropped it out of the list while it kept
 * running and kept holding a slot against the programme cap (user 2026-09-07).
 *
 * The rules live here rather than in App.tsx because they are neither React
 * nor presentation: one programme can be held under SEVERAL plan ids —
 * onboarding writes `onboarding_plan_<id>` and adoption writes
 * `ready_plan_<id>` — and both questions below turn on that fact.
 */

/** The only part of a plan these rules read. */
export interface RunningPlan {
  id: string;
  name: string;
  entries: Array<{ workoutTemplateId: string }>;
}

export interface RunningProgramme {
  /** The programme, which is what a reader means by "a programme". */
  templateId: string;
  /** The plan the row was resolved from, for anything that writes by plan. */
  planId: string;
  /** The plan's own name, the last resort when a template is unknown. */
  planName: string;
  /** Is this the one Home leads with? */
  leading: boolean;
}

/**
 * Every running programme, once each, leader first.
 *
 * Deduped by TEMPLATE and not by plan: two plan ids pointing at one programme
 * would otherwise produce two rows for it, under one key. The leader is
 * resolved first so that when a programme is held twice, the plan the row
 * carries is the one Home is actually leading with.
 *
 * `authoredTemplateIds` are the reader's own templates, which the caller lists
 * from its own source — they are excluded here so a programme cannot appear
 * both as authored and as running.
 */
export function listRunningProgrammes(input: {
  activePlanId: string | null;
  activePlanIds: readonly string[];
  plans: readonly RunningPlan[];
  authoredTemplateIds?: readonly string[];
}): RunningProgramme[] {
  const planById = new Map(input.plans.map((plan) => [plan.id, plan]));
  const seen = new Set<string>(input.authoredTemplateIds ?? []);
  const rows: RunningProgramme[] = [];

  for (const planId of [input.activePlanId, ...input.activePlanIds]) {
    if (!planId) {
      continue;
    }
    const plan = planById.get(planId);
    const templateId = plan?.entries[0]?.workoutTemplateId;
    if (!plan || !templateId || seen.has(templateId)) {
      continue;
    }
    seen.add(templateId);
    rows.push({
      templateId,
      planId,
      planName: plan.name,
      leading: planId === input.activePlanId,
    });
  }

  return rows;
}

/**
 * Every plan pointing at one programme.
 *
 * Stopping a programme has to take all of them. Removing only the leading plan
 * left the programme running under its other id — and the switch that reported
 * it stopped would have been lying.
 */
export function planIdsForTemplate(input: {
  activePlanId: string | null;
  activePlanIds: readonly string[];
  plans: readonly RunningPlan[];
  templateId: string;
}): string[] {
  const planById = new Map(input.plans.map((plan) => [plan.id, plan]));
  return [...new Set([input.activePlanId, ...input.activePlanIds])]
    .filter((planId): planId is string => Boolean(planId))
    .filter((planId) => planById.get(planId)?.entries[0]?.workoutTemplateId === input.templateId);
}
