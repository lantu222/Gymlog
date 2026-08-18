/**
 * When — and whether — the app is allowed to ask for a store rating.
 *
 * The rating sheet is the single highest-leverage growth surface an app has and
 * the single easiest one to poison: asked too early it collects one-star
 * reviews from people who have not yet trained once. So the decision lives here
 * as a pure function with the whole rule set in one place, not scattered across
 * the screens that happen to be on screen at a good moment.
 *
 * Two rules are policy, not taste, and must survive any later tuning:
 *
 * 1. NEVER branch on the star the reader picked. Routing 4–5 stars to the store
 *    and 1–3 stars to a private feedback form is "rating gating" and is against
 *    Google Play policy. Every star leads to the same place.
 * 2. The CTA opens the Play listing by deep link. Google's in-app review API
 *    must not be preceded by a custom prompt that asks for a rating, which is
 *    exactly what this sheet is — so the two cannot be combined.
 */

/** Nothing to rate before the app has actually done its job a few times. */
export const RATING_MIN_SESSIONS = 4;
/** A "no" has to last long enough that the second ask is not nagging. */
export const RATING_COOLDOWN_DAYS = 60;
/** Three asks over a lifetime. After that the answer is no. */
export const RATING_MAX_ASKS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RatingPromptState {
  /** ISO timestamp of the last time the sheet was shown, null if never. */
  lastAskedAt: string | null;
  /** How many times the sheet has been shown. */
  askCount: number;
  /** The reader went through to the store. We never ask again. */
  rated: boolean;
}

export const emptyRatingPromptState: RatingPromptState = {
  lastAskedAt: null,
  askCount: 0,
  rated: false,
};

export interface RatingPromptInput {
  state: RatingPromptState;
  /** Completed sessions in the log — cardio and strength both count. */
  sessionsLogged: number;
  /**
   * True only at a moment the reader just succeeded at something: a finished
   * session, a new record, a completed week. Asking mid-flow, or after a
   * failed save, buys a one-star review.
   */
  atPeakMoment: boolean;
  nowMs: number;
}

export type RatingPromptDecision =
  | { ask: true }
  | {
      ask: false;
      /** Why not — kept for tests and for the demo screen's readout. */
      reason: 'already_rated' | 'asked_enough' | 'too_few_sessions' | 'not_a_peak_moment' | 'cooling_down';
    };

export function decideRatingPrompt({
  state,
  sessionsLogged,
  atPeakMoment,
  nowMs,
}: RatingPromptInput): RatingPromptDecision {
  if (state.rated) {
    return { ask: false, reason: 'already_rated' };
  }
  if (state.askCount >= RATING_MAX_ASKS) {
    return { ask: false, reason: 'asked_enough' };
  }
  if (sessionsLogged < RATING_MIN_SESSIONS) {
    return { ask: false, reason: 'too_few_sessions' };
  }
  if (!atPeakMoment) {
    return { ask: false, reason: 'not_a_peak_moment' };
  }

  if (state.lastAskedAt !== null) {
    const lastMs = Date.parse(state.lastAskedAt);
    // A stored value we cannot read is treated as "asked just now" rather than
    // "never asked": a corrupt date must not become a way to ask every launch.
    if (Number.isNaN(lastMs)) {
      return { ask: false, reason: 'cooling_down' };
    }
    if (nowMs - lastMs < RATING_COOLDOWN_DAYS * DAY_MS) {
      return { ask: false, reason: 'cooling_down' };
    }
  }

  return { ask: true };
}

/** The sheet was shown. Called whether or not the reader acted on it. */
export function recordRatingAsked(state: RatingPromptState, nowMs: number): RatingPromptState {
  return {
    ...state,
    lastAskedAt: new Date(nowMs).toISOString(),
    askCount: state.askCount + 1,
  };
}

/** The reader went through to the store. There is no fourth ask after this. */
export function recordRatingCompleted(state: RatingPromptState): RatingPromptState {
  return { ...state, rated: true };
}
