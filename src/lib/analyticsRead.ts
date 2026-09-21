/**
 * Which stored event batches a read of api/events.ts returns.
 *
 * Pure, so Node can test what the endpoint keeps (analytics audit,
 * 2026-09-21). Three things were wrong with the reader, and each one made the
 * report quietly smaller than the data:
 *
 *  - `since` was the list prefix, so `--since 2026-09-01` meant "on 1
 *    September" and every later day was cut off before the lower-bound
 *    comparison ever saw it. api/transcripts.ts had the same bug and was
 *    fixed the same way: list the whole folder, compare the path.
 *  - Past 2000 batches it kept the newest 2000 and said nothing. A read is
 *    now pages, each one a page of the store's own listing, and the first
 *    says how many batches match in all.
 *  - All of them were fetched at once, and one fetch that threw took the
 *    whole read down with it: the try that skipped a bad batch began after
 *    the fetch. Now they are read in runs, each inside its own try.
 *
 * A page is one call to the store's list with its own cursor, not a slice of
 * a sorted listing: re-listing the whole folder for every page made a full
 * read cost the square of the batch count in billed list calls (review of
 * this change).
 */

/** A day or a month, as the folder names spell them. */
export const ANALYTICS_SINCE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/;

/** The folder the endpoint writes to, one subfolder per UTC arrival day. */
export const EVENTS_PREFIX = 'events/';

/**
 * Batches per page. A batch is at most a hundred small events; five hundred
 * of the largest stay under the platform's response limit, and a typical page
 * is a fraction of it.
 */
export const ANALYTICS_READ_PAGE_MAX = 500;

/** How many blobs are read at once. */
export const ANALYTICS_READ_CONCURRENCY = 25;

/**
 * The event batches among `pathnames` that arrived on or after `since`,
 * oldest first. `since` is a lower bound on the day, never the only day; a
 * month is a lower bound too. Anything outside `events/` is not an event
 * batch, whatever else the store holds.
 */
export function selectEventBatches(pathnames: readonly string[], since?: string): string[] {
  const floor = since ? `${EVENTS_PREFIX}${since}` : EVENTS_PREFIX;
  return pathnames.filter((pathname) => pathname.startsWith(EVENTS_PREFIX) && pathname >= floor).sort();
}

/** `items` in runs of `size`, in order; the last run may be shorter. */
export function inChunks<T>(items: readonly T[], size: number): T[][] {
  const step = Math.max(1, Math.floor(size));
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += step) {
    chunks.push(items.slice(index, index + step));
  }
  return chunks;
}
