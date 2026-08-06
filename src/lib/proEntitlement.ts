import { AppPreferences } from '../types/models';

/**
 * One place decides whether the user has Pro. Two things can grant it today:
 * a redeemed promo that has not expired, and the premium preview switch that
 * Settings/Premium already exposes. Billing is not live, so those are the only
 * honest sources — this helper exists so no screen invents a third.
 */
export interface ProEntitlement {
  unlocked: boolean;
  /** Why it is unlocked, so a screen can be truthful about it. */
  source: 'promo' | 'preview' | null;
  /** ISO date the promo runs out; null when Pro is not promo-based. */
  promoUntil: string | null;
}

type ProPreferences = Pick<AppPreferences, 'promoProUntil' | 'adaptiveCoachPremiumUnlocked'>;

export function resolveProEntitlement(
  preferences: ProPreferences,
  now: Date = new Date(),
): ProEntitlement {
  const promoUntil = preferences.promoProUntil;
  const promoTime = promoUntil ? new Date(promoUntil).getTime() : Number.NaN;
  const promoActive = Number.isFinite(promoTime) && promoTime > now.getTime();

  if (promoActive) {
    return { unlocked: true, source: 'promo', promoUntil };
  }

  if (preferences.adaptiveCoachPremiumUnlocked) {
    return { unlocked: true, source: 'preview', promoUntil: null };
  }

  return { unlocked: false, source: null, promoUntil: null };
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
 * Turning it off is not enough on its own: the paywall's CTA says "Start 7
 * days free", and a button that grants nothing while promising a week is worse
 * than no button. ProPaywallScreen reads this flag and sells the year instead.
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
