/**
 * What the app offers once the questions are over, before it lets go.
 *
 * Onboarding used to end by dropping the reader on Home. Two things they would
 * otherwise have to find on their own belong right there instead: the widget,
 * and a card that tracks the body part they just said they cared about.
 *
 * The second one is the point of doing this here rather than later. The reader
 * has just answered "glutes"; a generic "track something" offer a week later
 * has forgotten that, and this has not.
 */
import type { MeasurementKind, SetupFocusArea } from '../types/models';

/**
 * The tape measurement that tracks a focus area.
 *
 * Twelve focus areas, seven tape measurements, so this is not a rename — it is a
 * mapping, and it has to be written down rather than guessed at a call site:
 * glutes are measured at the hips, hamstrings and quads at the thigh, core at
 * the waist. Areas with no tape at all (back, mobility) resolve to null and the
 * offer falls back to bodyweight, which is the one number every reader has.
 */
const FOCUS_MEASUREMENT: Partial<Record<SetupFocusArea, MeasurementKind>> = {
  glutes: 'hips',
  legs: 'thighs',
  quads: 'thighs',
  hamstrings: 'thighs',
  calves: 'calves',
  chest: 'chest',
  shoulders: 'shoulders',
  arms: 'arms',
  core: 'waist',
};

export interface SetupTrackingOffer {
  /** A key from the Home stat-card catalog — a measurement kind, or bodyweight. */
  cardKey: MeasurementKind | 'bodyweight';
  /**
   * The focus area this came from, or null when it is the bodyweight fallback.
   * The screen uses it to name what the reader said, rather than what is being
   * measured: "glutes" is what they chose, "hips" is only how it is measured.
   */
  focus: SetupFocusArea | null;
}

/**
 * Which tracking card to offer, given what the reader said they were training.
 *
 * The first focus area with a tape measurement wins — onboarding lets several be
 * picked, and offering three cards at the door is not an offer, it is a form.
 */
export function resolveSetupTrackingOffer(focusAreas: SetupFocusArea[]): SetupTrackingOffer {
  for (const focus of focusAreas) {
    const cardKey = FOCUS_MEASUREMENT[focus];
    if (cardKey) {
      return { cardKey, focus };
    }
  }

  return { cardKey: 'bodyweight', focus: null };
}

export interface SetupHandoffInput {
  /** False when the launcher cannot pin widgets, or one is already placed. */
  canOfferWidget: boolean;
  /** Card keys already on Home. Bodyweight is there by default. */
  pinnedCardKeys: string[];
  focusAreas: SetupFocusArea[];
}

export interface SetupHandoffPlan {
  /** False when there is nothing left to offer and the step must not appear. */
  shouldShow: boolean;
  offerWidget: boolean;
  /** Null when the card this reader would be offered is already on Home. */
  tracking: SetupTrackingOffer | null;
  /**
   * The bodyweight card as a second offer, when the focus card is not already
   * bodyweight and bodyweight is not already on Home. One number every reader
   * has; asked for by the user (2026-08-19) as the obvious second card.
   */
  offerBodyweight: boolean;
}

/**
 * Whether the hand-off has anything to say, and what.
 *
 * A step that offers nothing is worse than no step: it is one more tap between
 * the questions and the app. So this returns `shouldShow: false` when the widget
 * cannot be pinned and the card is already there — which is exactly what happens
 * to a reader who runs onboarding a second time.
 */
export function planSetupHandoff(input: SetupHandoffInput): SetupHandoffPlan {
  const offer = resolveSetupTrackingOffer(input.focusAreas);
  const tracking = input.pinnedCardKeys.includes(offer.cardKey) ? null : offer;

  const offerBodyweight =
    offer.cardKey !== 'bodyweight' && !input.pinnedCardKeys.includes('bodyweight');

  return {
    shouldShow: input.canOfferWidget || tracking !== null || offerBodyweight,
    offerWidget: input.canOfferWidget,
    tracking,
    offerBodyweight,
  };
}

/**
 * How many offers the step actually shows — what the heading has to agree
 * with. It read "Two things before you start · Both take one tap" over a
 * single card whenever the widget was already on the home screen, which on a
 * phone that has had the app before is the usual case.
 */
export function countSetupHandoffOffers(
  plan: Pick<SetupHandoffPlan, 'offerWidget' | 'tracking' | 'offerBodyweight'>,
): number {
  return (plan.offerWidget ? 1 : 0) + (plan.tracking ? 1 : 0) + (plan.offerBodyweight ? 1 : 0);
}
