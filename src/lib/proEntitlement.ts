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
