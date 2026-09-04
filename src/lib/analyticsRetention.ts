/**
 * How long the anonymous usage events live, and which stored batches are
 * past it. The privacy policy states the number ("up to 24 months"); this is
 * the code that keeps the promise, and tests/lib/analyticsRetention.test.cjs
 * fails if the two ever disagree.
 *
 * Pure on purpose: the endpoint (api/prune-events.ts) lists and deletes, the
 * arithmetic lives here where Node can test it against a fixed clock.
 */

export const ANALYTICS_RETENTION_MONTHS = 24;

/** `events/YYYY-MM-DD/<batch>.json` — the day is the batch's arrival day, UTC. */
const EVENT_BLOB_PATTERN = /^events\/(\d{4}-\d{2}-\d{2})\//;

/**
 * The first day still inside the retention window at `now`, as a UTC
 * calendar date. Batches from days before it are past the window.
 *
 * Steps by calendar month rather than by a fixed number of milliseconds —
 * the CLAUDE.md rule about DAY_MS one level up: a "month" of 30 days drifts a
 * week over two years. A day that does not exist in the target month (29
 * February two years back) rolls forward to the next real day, which keeps
 * a batch a day longer, never deletes one a day early.
 */
export function analyticsRetentionCutoffDay(now: Date, months: number = ANALYTICS_RETENTION_MONTHS): string {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
  return cutoff.toISOString().slice(0, 10);
}

/** The arrival day of a stored batch, or null for anything that is not one. */
export function eventBlobDay(pathname: string): string | null {
  const match = EVENT_BLOB_PATTERN.exec(pathname);
  return match ? match[1] : null;
}

/**
 * Which of the stored batches are older than the window at `now`. Anything
 * that is not an event batch — an index, a stray file, another prefix — is
 * left alone: this deletes usage events and nothing else.
 */
export function selectExpiredEventBlobs(
  pathnames: readonly string[],
  now: Date,
  months: number = ANALYTICS_RETENTION_MONTHS,
): string[] {
  const cutoff = analyticsRetentionCutoffDay(now, months);
  return pathnames.filter((pathname) => {
    const day = eventBlobDay(pathname);
    return day !== null && day < cutoff;
  });
}
