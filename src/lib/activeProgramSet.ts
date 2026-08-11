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
