/**
 * How many programs of your own you may keep on the free tier.
 *
 * The cap is on AUTHORING, never on the log and never on the catalog. Both
 * leaders in this category cap saved routines — Hevy at 4, Strong at 3 — and
 * their paying users say almost unanimously that this is what they paid for,
 * in those words: "I upgraded purely just so I can create multiple workouts."
 * Nobody cites the charts.
 *
 * Three things this cap deliberately does NOT touch:
 *
 * - Ready programs. All 55 stay free and switchable, because the catalog's own
 *   copy invites you to browse and swap, and a cap on choosing would punish
 *   exploring rather than authoring. The funnel is the moment you want a ready
 *   program changed: that duplicates into one of your own, and THAT is the
 *   slot. "I want it my way" is the documented buying moment; "let me see what
 *   else there is" is not.
 * - Your log. Sessions, sets and history are never capped in either tier.
 * - What you already made. See `canCreate` below.
 */

export const FREE_CUSTOM_PROGRAM_LIMIT = 3;

export interface ProgramSlots {
  used: number;
  /** Null when there is no limit — a Pro account. */
  limit: number | null;
  /** False only when a NEW program would exceed the limit. */
  canCreate: boolean;
  /** True when the user is already over the limit and nothing was taken away. */
  overLimit: boolean;
}

/**
 * Hevy's rule, deliberately: a user who is over the cap keeps everything they
 * built and can still edit it — only creating another is blocked.
 *
 * Taking something back is the one move that turns a pricing change into a
 * grievance. Hevy removed a shipped feature once and had to restore it after
 * the backlash ("we realized we made a mistake in calibrating the impact of
 * its removal"), and their own community documents the workaround where a
 * lapsed subscriber keeps the routines they made while paying. So: the cap
 * gates the next one, never the ones you have.
 */
export function resolveProgramSlots(customProgramCount: number, proUnlocked: boolean): ProgramSlots {
  const used = Math.max(0, customProgramCount);
  if (proUnlocked) {
    return { used, limit: null, canCreate: true, overLimit: false };
  }
  return {
    used,
    limit: FREE_CUSTOM_PROGRAM_LIMIT,
    canCreate: used < FREE_CUSTOM_PROGRAM_LIMIT,
    overLimit: used > FREE_CUSTOM_PROGRAM_LIMIT,
  };
}

/** Thrown when a create is attempted past the cap, so no caller can miss it. */
export class ProgramLimitReachedError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(`Free programs are limited to ${limit}`);
    this.name = 'ProgramLimitReachedError';
    this.limit = limit;
  }
}
