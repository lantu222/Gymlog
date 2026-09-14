/**
 * How many programmes a reader may run at once.
 *
 * The app used to hold exactly one: `preferences.activePlanId` was a single id,
 * and the only writers were the two onboarding finishes. That made joining a
 * season destructive — the season programme could only arrive by evicting
 * whatever the reader had built their week around.
 *
 * A season is a separate commitment, not a replacement for one, so programmes
 * became a set. The cap is what keeps that set from turning Home into a list
 * nobody reads, and it is the first real programme cap in the app: the pricing
 * decision existed on paper but nothing in the code had ever enforced it.
 */

export const FREE_ACTIVE_PROGRAM_CAP = 2;
export const PRO_ACTIVE_PROGRAM_CAP = 5;

export function resolveActiveProgramCap(proUnlocked: boolean): number {
  return proUnlocked ? PRO_ACTIVE_PROGRAM_CAP : FREE_ACTIVE_PROGRAM_CAP;
}

export type ProgramAdoptionDecision =
  /** Already running it — the button should offer to train, not to join. */
  | { kind: 'already_active' }
  /** There is room; adopting adds it alongside what is already there. */
  | { kind: 'adopt'; used: number; cap: number }
  /**
   * The set is full. A free reader is one upgrade away; a Pro reader at five is
   * not, and must drop a programme first — telling them to buy something they
   * already own would be the paywall lying.
   */
  | { kind: 'blocked'; used: number; cap: number; canUpgrade: boolean };

export interface ProgramAdoptionInput {
  /** Ids of the programmes already running. */
  activePlanIds: readonly string[];
  /** The plan id the reader is trying to add. */
  targetPlanId: string;
  proUnlocked: boolean;
}

export function evaluateProgramAdoption(input: ProgramAdoptionInput): ProgramAdoptionDecision {
  const cap = resolveActiveProgramCap(input.proUnlocked);
  // Duplicates would let a reader spend cap on the same programme twice.
  const unique = Array.from(new Set(input.activePlanIds));

  if (unique.includes(input.targetPlanId)) {
    return { kind: 'already_active' };
  }

  if (unique.length >= cap) {
    return { kind: 'blocked', used: unique.length, cap, canUpgrade: !input.proUnlocked };
  }

  return { kind: 'adopt', used: unique.length, cap };
}

/**
 * Adding a programme to the set.
 *
 * Returns the set unchanged when it is already there, so a double tap cannot
 * produce two entries pointing at one programme.
 */
export function addActiveProgram(activePlanIds: readonly string[], planId: string): string[] {
  const unique = Array.from(new Set(activePlanIds));
  return unique.includes(planId) ? unique : [...unique, planId];
}

/**
 * Dropping a programme.
 *
 * A cap without a way out of it is a trap: two programmes in, every further
 * choice is a paywall the reader cannot dismiss by changing their mind.
 */
export function removeActiveProgram(activePlanIds: readonly string[], planId: string): string[] {
  return Array.from(new Set(activePlanIds)).filter((id) => id !== planId);
}

/** Every plan onboarding writes is named this, followed by its template id. */
export const ONBOARDING_PLAN_PREFIX = 'onboarding_plan_';

/**
 * The lead counted in the running set, for installs whose set left it out.
 *
 * Every install that finished guided onboarding before activateOnboardingPlan
 * existed has its programme as the lead and nowhere in the set, and nothing
 * rewrites stored preferences on its own, so the cap would keep undercounting
 * there by one. Applied on load. A lead whose plan is gone, or has no days
 * left, is not a programme anyone is running and is not given a slot.
 */
export function includeLeadInRunningSet<T extends { activePlanId: string | null; activePlanIds: string[] }>(
  preferences: T,
  plans: ReadonlyArray<{ id: string; entries: ReadonlyArray<unknown> }>,
): T {
  const lead = preferences.activePlanId;
  if (!lead || preferences.activePlanIds.includes(lead)) {
    return preferences;
  }
  const plan = plans.find((candidate) => candidate.id === lead);
  if (!plan || plan.entries.length === 0) {
    return preferences;
  }
  return { ...preferences, activePlanIds: addActiveProgram(preferences.activePlanIds, lead) };
}

/**
 * The running set once onboarding hands the reader a programme.
 *
 * The new plan leads, and it joins the set like every other programme. It used
 * to become the lead only, outside the set the cap counts: a free reader
 * finished onboarding, adopted two ready programmes on top, and ran three
 * against a cap of two while the cap notice read 2 of 2.
 *
 * A plan onboarding wrote before is replaced, not kept beside the new one:
 * running the questionnaire again is answering it again. Anything the reader
 * adopted themselves — a ready programme, a season — stays.
 *
 * Unless there is no room. Setup can be run again from Profile at any time,
 * and a free reader already running two programmes they adopted by hand would
 * otherwise come out of it with three (PR review, 2026-09-14). The answers are
 * a new version of the programme the reader leads with, so at the cap the new
 * plan takes the lead's place instead of a slot of its own. No paywall at the
 * end of a questionnaire — that seam had one removed on purpose.
 */
export function activateOnboardingPlan(
  current: { activePlanId: string | null; activePlanIds: readonly string[] },
  planId: string,
  cap: number,
): { activePlanId: string; activePlanIds: string[] } {
  let kept = Array.from(new Set(current.activePlanIds)).filter(
    (id) => !id.startsWith(ONBOARDING_PLAN_PREFIX) || id === planId,
  );
  const lead = current.activePlanId;
  if (!kept.includes(planId) && kept.length >= cap && lead && kept.includes(lead)) {
    kept = kept.filter((id) => id !== lead);
  }
  return { activePlanId: planId, activePlanIds: addActiveProgram(kept, planId) };
}

/**
 * The programme a new run of onboarding writes over, or null to write a new one.
 *
 * Answering setup again used to add a programme every time, and the one it
 * answered for stayed in "your programmes" — three runs filled the free
 * limit with near-copies nobody built (user decision 2026-09-14: replace it).
 * Only the running programme onboarding itself wrote qualifies, and only while
 * the reader has done nothing with it: a template's `updatedAt` moves with
 * every save and rename, so equal timestamps mean it was never edited — and
 * no completed session may name it, because writing over a trained programme
 * regenerates its exercise rows under new ids, and every "last time" weight,
 * progression lookup and record check for it would then find nothing (PR
 * review, 2026-09-14). An edited or trained one is the reader's; it stays, and
 * the new run is a new programme that counts like any other. The lead is asked
 * first.
 */
export function findReplaceableOnboardingTemplateId(input: {
  activePlanId: string | null;
  activePlanIds: readonly string[];
  templates: ReadonlyArray<{ id: string; createdAt: string; updatedAt: string }>;
  sessions: ReadonlyArray<{ workoutTemplateId: string }>;
}): string | null {
  const running = [input.activePlanId, ...input.activePlanIds].filter(
    (planId): planId is string => typeof planId === 'string' && planId.startsWith(ONBOARDING_PLAN_PREFIX),
  );
  const trained = new Set(input.sessions.map((session) => session.workoutTemplateId));
  for (const planId of running) {
    const templateId = planId.slice(ONBOARDING_PLAN_PREFIX.length);
    const template = input.templates.find((candidate) => candidate.id === templateId);
    if (template && template.createdAt === template.updatedAt && !trained.has(templateId)) {
      return templateId;
    }
  }
  return null;
}
