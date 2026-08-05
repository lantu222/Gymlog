import { isDemoBuild } from './demoMode';

/**
 * Invented start counts, for the demo build only.
 *
 * "2 480 aloitusta" is social proof, and social proof needs other people. This
 * device knows what YOU started and nothing else, so a real trending row needs
 * a server that counts starts — which is the user's decision (2026-08-04), and
 * which is not built yet.
 *
 * Two things have to be true before this row can ship for real, and
 * releaseReadiness.test.cjs asserts both:
 *
 * 1. The counter exists. Until then these numbers are made up, exactly like
 *    the "n = 4,812" cohort on the paywall, and they hang off the same flag
 *    for the same reason.
 * 2. `settings.analytics.sub` is rewritten. It currently promises "We collect
 *    nothing. Your training data stays on this phone", and a start counter is
 *    collection. Shipping the row without changing that sentence would make
 *    the app lie in Settings to sell a row on the Programs tab.
 *
 * The numbers are deliberately unround and unequal — a demo where everything
 * sits at 1 000 reads as placeholder, which defeats the point of previewing
 * the layout at all.
 */

export interface TrendingEntry {
  templateId: string;
  starts: number;
}

const DEMO_TRENDING: readonly TrendingEntry[] = [
  { templateId: 'tpl_3_day_push_pull_legs_v1', starts: 2480 },
  { templateId: 'tpl_shred_v1', starts: 1910 },
  { templateId: 'tpl_3_day_strength_base_v1', starts: 1642 },
  { templateId: 'tpl_4_day_upper_lower_v1', starts: 1205 },
  { templateId: 'tpl_huge_starter_v1', starts: 1088 },
];

/**
 * The trending list, or null when there is nothing honest to show.
 *
 * Null in a release build is the whole design: the row disappears rather than
 * rendering a number nobody counted. A caller that renders on null would be
 * inventing the data itself, so there is nothing to fall back to.
 */
export function getTrendingEntries(): readonly TrendingEntry[] | null {
  return isDemoBuild() ? DEMO_TRENDING : null;
}
