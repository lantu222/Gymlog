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

export function resolveTrialProUntil(now: Date = new Date()): string {
  const until = new Date(now.getTime());
  until.setDate(until.getDate() + PRO_TRIAL_DAYS);
  return until.toISOString();
}
