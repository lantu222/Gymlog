/**
 * How far back the trend charts reach on the free tier.
 *
 * This is the market's second-strongest converter after the program cap — Hevy
 * caps its charts at three months and its paying users name it unprompted: "I
 * bought it because I wanted to be able to see more than just three months of
 * history data." So the window is worth charging for.
 *
 * But it is a window on the CHARTS, and on nothing else. The distinction is
 * the whole point and it is easy to get wrong:
 *
 *   Free, forever, uncapped        Pro
 *   ─────────────────────────      ──────────────────────
 *   every session in History       the 6-month trend
 *   every set on a lift            the all-time trend
 *   CSV export                     measures past a year
 *   personal records
 *
 * Capping the LOG would be the thing this app has spent its whole design
 * refusing to do, and the competitor who effectively did it — Strong's v6
 * update lost people years of saved workouts — is the cautionary tale, not the
 * model. A user on the free tier can still read, search and export every set
 * they have ever logged. What they cannot do is draw a line through five years
 * of it.
 */

export const FREE_TREND_MONTHS = 3;

/** Overview trend ranges, shortest first. */
export type TrendRange = '1m' | '3m' | '6m' | 'all';
/** Body-measure ranges, shortest first. */
export type MeasureTrendRange = '3m' | '1y' | 'all';

const FREE_TREND_RANGES: readonly TrendRange[] = ['1m', '3m'];
const FREE_MEASURE_RANGES: readonly MeasureTrendRange[] = ['3m'];

export function isTrendRangeLocked(range: TrendRange, proUnlocked: boolean): boolean {
  return !proUnlocked && !FREE_TREND_RANGES.includes(range);
}

export function isMeasureRangeLocked(range: MeasureTrendRange, proUnlocked: boolean): boolean {
  return !proUnlocked && !FREE_MEASURE_RANGES.includes(range);
}

/**
 * The range actually drawn.
 *
 * Entitlement can lapse while the screen is mounted — a promo code runs out,
 * the preview switch goes off — and the selected range is component state that
 * knows nothing about it. Without this, a chart chosen while Pro was on keeps
 * drawing six months after it is off. Falls back to the longest free range so
 * the view narrows rather than resetting to nothing.
 */
export function resolveTrendRange(range: TrendRange, proUnlocked: boolean): TrendRange {
  return isTrendRangeLocked(range, proUnlocked) ? '3m' : range;
}

export function resolveMeasureRange(
  range: MeasureTrendRange,
  proUnlocked: boolean,
): MeasureTrendRange {
  return isMeasureRangeLocked(range, proUnlocked) ? '3m' : range;
}
