/**
 * Start counts, when there is a counter.
 *
 * "2 480 aloitusta" is social proof, and social proof needs other people. This
 * device knows what YOU started and nothing else, so the numbers that used to
 * live here were invented — they shipped behind isDemoBuild, which made them
 * unreachable in a release build but did not make them true, and the demo build
 * is what the reader actually holds.
 *
 * They are gone. What is left is the shape a real answer would have, so the row
 * can be rebuilt the day a server counts starts. Two things have to be true
 * before it renders again, and releaseReadiness.test.cjs asserts both:
 *
 * 1. The counter exists and this function returns its numbers.
 * 2. `settings.analytics.sub` is rewritten. It currently promises "We collect
 *    nothing. Your training data stays on this phone", and a start counter is
 *    collection. Shipping the row without changing that sentence would make
 *    the app lie in Settings to sell a row on the Programs tab.
 *
 * Layout note for that day: the row has to hold five digits with a thousands
 * separator ("12 480 aloitusta") without the programme name losing its line.
 */

export interface TrendingEntry {
  templateId: string;
  starts: number;
}

/**
 * The trending list, or null when there is nothing honest to show.
 *
 * Null is the whole design: the row disappears rather than rendering a number
 * nobody counted. A caller that renders on null would be inventing the data
 * itself, so there is nothing to fall back to.
 */
export function getTrendingEntries(): readonly TrendingEntry[] | null {
  return null;
}
