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

/**
 * The prefixes the cron may delete from, and the shape of a day inside them.
 *
 * `events/YYYY-MM-DD/<batch>.json` — anonymous usage events.
 * `transcripts/YYYY-MM-DD/<time>.json` — coach questions and answers, written
 * only for a reader who consented to it (2026-09-10). Same window and same
 * cron: a promise of 24 months that covered one prefix and not the other was
 * two promises wearing one number.
 *
 * The day in both is the arrival day in UTC, which is what the writer names
 * the folder after.
 */
export const RETAINED_PREFIXES = ['events', 'transcripts'] as const;
const EVENT_BLOB_PATTERN = new RegExp(
  // Doubled, because this is a template literal and not a regex literal:
  // `\d` in a string is the letter d, and the pattern quietly became
  // "dddd-dd-dd" — matching nothing, so the cron would have deleted nothing.
  `^(?:${RETAINED_PREFIXES.join('|')})/(\\d{4}-\\d{2}-\\d{2})/`,
);

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

/**
 * The arrival day of a stored blob the cron owns, or null for anything else.
 *
 * Named for events because that is all it used to match. It answers for both
 * prefixes now, and the name stayed rather than rippling through the endpoint
 * and its tests for no gain.
 */
export function eventBlobDay(pathname: string): string | null {
  const match = EVENT_BLOB_PATTERN.exec(pathname);
  return match ? match[1] : null;
}

/**
 * Which of the stored blobs are older than the window at `now`. Anything under
 * another prefix — an index, a stray file, the cloud backups — is left alone:
 * this deletes what it was given a retention promise for and nothing else.
 * A backup is kept until its owner deletes it, which is a different promise.
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
