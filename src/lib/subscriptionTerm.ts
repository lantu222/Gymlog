/**
 * When a subscription term runs out.
 *
 * Only the arithmetic lives here, not the terms table — subscriptionView keeps
 * that, with its labels and CTAs. The split exists for one reason: the
 * entitlement has to know when a purchase ends, subscriptionView already
 * imports ProEntitlement, and proEntitlement importing a value back would be a
 * runtime cycle. Both import this instead.
 */
export type SubscriptionTermKey = 'monthly' | 'yearly' | 'lifetime';

/** Lifetime is bought once and never charged again; the other two renew. */
export const TERM_RENEWS: Record<SubscriptionTermKey, boolean> = {
  monthly: true,
  yearly: true,
  lifetime: false,
};

export function isSubscriptionTermKey(value: unknown): value is SubscriptionTermKey {
  return value === 'monthly' || value === 'yearly' || value === 'lifetime';
}

/**
 * One period on from a charge.
 *
 * Lifetime returns null, because it does not renew at all.
 */
export function nextChargeAt(term: SubscriptionTermKey, lastChargedAtIso: string): string | null {
  if (!TERM_RENEWS[term]) {
    return null;
  }
  const last = new Date(lastChargedAtIso);
  if (Number.isNaN(last.getTime())) {
    return null;
  }
  /**
   * UTC arithmetic, not local.
   *
   * `setMonth`/`setFullYear` work in local time, so a period that crosses a
   * daylight-saving boundary lands an hour off — a March purchase renewed into
   * April came out 08:00 from an 09:00 purchase. An hour is invisible in a
   * formatted date until the purchase sits near midnight, and then it is a
   * whole day wrong.
   */
  const next = new Date(last.getTime());
  const day = next.getUTCDate();
  if (term === 'monthly') {
    next.setUTCMonth(next.getUTCMonth() + 1);
  } else {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  // Month-end overflow: the 31st plus a month is the 3rd of the month after,
  // because JS rolls forward rather than clamping. A subscription bought on the
  // 31st renews on the last day of a short month, so clamp back into it.
  if (next.getUTCDate() !== day) {
    next.setUTCDate(0);
  }
  return next.toISOString();
}

/** A subscription older than this many periods is not worth walking forward. */
const MAX_PERIODS = 400;

/**
 * The end of the period the reader is currently inside.
 *
 * A purchase from three months ago on a monthly term has renewed twice since,
 * so its period does not end one month after the purchase — it ends one month
 * after the last renewal. Rolling forward is what makes "you keep it until
 * {date}" true for a cancellation at any point in the subscription's life,
 * rather than only during its first period.
 *
 * Null for lifetime (no period ends) and for a date that cannot be read.
 */
export function currentPeriodEndAt(
  term: SubscriptionTermKey,
  purchasedAtIso: string,
  now: Date = new Date(),
): string | null {
  if (!TERM_RENEWS[term]) {
    return null;
  }
  let cursor = purchasedAtIso;
  for (let period = 0; period < MAX_PERIODS; period += 1) {
    const next = nextChargeAt(term, cursor);
    if (next === null) {
      return null;
    }
    if (new Date(next).getTime() > now.getTime()) {
      return next;
    }
    cursor = next;
  }
  return null;
}
