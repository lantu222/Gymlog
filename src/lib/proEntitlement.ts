import { currentPeriodEndAt } from './subscriptionTerm';
import { AppPreferences } from '../types/models';

/**
 * One place decides whether the user has Pro, and it grants it from exactly
 * two things: a redeemed promo code that has not expired, and a recorded
 * purchase.
 *
 * There used to be a third — a "premium preview" switch the Pro page's CTA
 * flipped, with a button underneath to flip it back. That is not a paywall,
 * it is a light switch: Pro could be turned on and off for free, from inside
 * the app, as often as you liked. It also never ended, so a cancelled
 * membership kept every feature forever and a "monthly" purchase renewed
 * itself for eternity. All three are gone (user 2026-09-03: "blokataan kaikki
 * suunnat mistä pro-ominaisuudet saa kytkettyä päälle ilman ostoa").
 *
 * The purchase is simulated — there is no billing account to take money yet —
 * but it is simulated the whole way: it records the instant and the term, it
 * renews on its own, cancelling runs it to the end of the period the reader
 * paid for, and then it stops. The only thing the demo build cannot do is
 * charge, which is why extra.demoBuild gates the invented card and receipt
 * (see subscriptionView.showsMockBilling) and releaseReadiness fails if that
 * flag disappears while no billing library is installed.
 */
export interface ProEntitlement {
  unlocked: boolean;
  /** Why it is unlocked, so a screen can be truthful about it. */
  source: 'promo' | 'purchase' | null;
  /** ISO date the promo runs out; null when Pro is not promo-based. */
  promoUntil: string | null;
  /**
   * ISO date a cancelled purchase stops working. Null while it is still
   * renewing, for lifetime, and when Pro is not purchase-based — "End
   * membership on {date}" is this value, not a date written into copy.
   */
  purchaseEndsAt: string | null;
}

type ProPreferences = Pick<
  AppPreferences,
  'promoProUntil' | 'mockSubscriptionPurchasedAt' | 'mockSubscriptionTerm' | 'mockSubscriptionCancelledAt'
>;

const NOT_UNLOCKED: ProEntitlement = { unlocked: false, source: null, promoUntil: null, purchaseEndsAt: null };

export function resolveProEntitlement(
  preferences: ProPreferences,
  now: Date = new Date(),
): ProEntitlement {
  const promoUntil = preferences.promoProUntil;
  const promoTime = promoUntil ? new Date(promoUntil).getTime() : Number.NaN;
  if (Number.isFinite(promoTime) && promoTime > now.getTime()) {
    return { unlocked: true, source: 'promo', promoUntil, purchaseEndsAt: null };
  }

  const purchasedAt = preferences.mockSubscriptionPurchasedAt;
  if (!purchasedAt || Number.isNaN(new Date(purchasedAt).getTime())) {
    return NOT_UNLOCKED;
  }

  const purchased = { unlocked: true, source: 'purchase' as const, promoUntil: null };
  const cancelledAt = preferences.mockSubscriptionCancelledAt;
  if (!cancelledAt || Number.isNaN(new Date(cancelledAt).getTime())) {
    // Still renewing, so there is no end to name.
    return { ...purchased, purchaseEndsAt: null };
  }

  // Cancelled. The period it runs to is the one it was cancelled IN —
  // measured from the cancellation, not from now, or the subscription
  // would keep renewing after it was cancelled. Lifetime has no period
  // left to run, so cancelling one takes it away at once.
  const endsAt = currentPeriodEndAt(
    preferences.mockSubscriptionTerm,
    purchasedAt,
    new Date(cancelledAt),
  );
  if (endsAt === null) {
    return NOT_UNLOCKED;
  }
  if (new Date(endsAt).getTime() <= now.getTime()) {
    return NOT_UNLOCKED;
  }
  return { ...purchased, purchaseEndsAt: endsAt };
}

export function isProUnlocked(preferences: ProPreferences, now: Date = new Date()) {
  return resolveProEntitlement(preferences, now).unlocked;
}

type ProgressionPreferences = ProPreferences &
  Pick<AppPreferences, 'automatedProgressionEnabled' | 'setupLevel'>;

/**
 * Automated progression is a Pro feature (user decision 2026-07-28: the
 * post-onboarding paywall sells it, so the gate has to be real). This is the
 * one place that combines the user's toggle with the entitlement — every
 * startWorkout/startCustomWorkout call site goes through here, so no screen
 * can accidentally hand a free user a paid prefill or a Pro user a dead
 * toggle. The toggle itself stays the user's choice: Pro OFF still means OFF.
 */
export function resolveProgressionOptions(
  preferences: ProgressionPreferences,
  now: Date = new Date(),
): { automatedProgressionEnabled: boolean; setupLevel: AppPreferences['setupLevel'] } {
  return {
    automatedProgressionEnabled:
      preferences.automatedProgressionEnabled && isProUnlocked(preferences, now),
    setupLevel: preferences.setupLevel,
  };
}

/**
 * The onboarding paywall's free trial.
 *
 * It grants Pro the same way a promo code does — a stretch of days from this
 * moment, expiring on its own — rather than being a button that only navigates.
 * That is what makes "Start 7 days free" a true sentence: the seven days are
 * real and the features really unlock. What the screen still cannot deliver is
 * the sentence after it ("then 59,90 € / year"): there is no billing to charge
 * anyone, which is why that copy lives behind the demo-build guard.
 */
export const PRO_TRIAL_DAYS = 7;

/**
 * OFF, deliberately and temporarily.
 *
 * The trial made every new account a Pro account for its first week, which is
 * the correct thing to ship — you cannot sell what nobody has felt — but it
 * also meant nobody could see the free tier. Not the team, not the designer,
 * not the person deciding whether the locks land where they should. So it is
 * switched off while the free tier is walked end to end.
 *
 * It goes back on before release. `tests/releaseReadiness` fails the moment
 * app.json stops declaring extra.demoBuild while this is still false, so the
 * switch cannot reach a store by being forgotten.
 *
 * Turning it off is not enough on its own: a CTA that says "Start 7 days
 * free" while granting nothing is worse than no button, so the Pro page reads
 * this flag and sells the year instead. (The onboarding paywall used to read
 * it too, until that screen was deleted 2026-08-25.)
 */
export const PRO_TRIAL_ENABLED = false;

/** The date Pro should run until, or null when the trial is switched off. */
export function resolveTrialProUntil(now: Date = new Date()): string | null {
  if (!PRO_TRIAL_ENABLED) {
    return null;
  }
  const until = new Date(now.getTime());
  until.setDate(until.getDate() + PRO_TRIAL_DAYS);
  return until.toISOString();
}
