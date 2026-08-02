/**
 * Promo codes, and the only place that decides what one is worth.
 *
 * Kept out of the screen so the grant is testable without a UI, and so a second
 * code is a data change rather than another branch in a handler. Codes are
 * matched case-insensitively after trimming: people type them off a poster.
 *
 * A code grants Pro for a stretch of days from the moment it is redeemed, not
 * until a fixed date — a hardcoded expiry silently becomes a dead code, and a
 * dead code looks like a broken app rather than an expired campaign.
 */
export interface PromoGrant {
  /** Days of Pro this code is worth, counted from redemption. */
  proDays: number;
}

const PROMO_CODES: Record<string, PromoGrant> = {
  vinhauusi2026: { proDays: 30 },
};

/**
 * Returns the ISO date Pro should run until, or null when the code is unknown.
 */
export function redeemPromoCode(input: string, now: Date = new Date()): string | null {
  const grant = PROMO_CODES[input.trim().toLowerCase()];
  if (!grant) {
    return null;
  }

  const until = new Date(now.getTime());
  until.setDate(until.getDate() + grant.proDays);
  return until.toISOString();
}

/** Every live code, for the demo sheet that has to show one to be useful. */
export function listPromoCodes(): string[] {
  return Object.keys(PROMO_CODES);
}
