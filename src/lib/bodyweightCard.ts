import { BodyweightEntry } from '../types/models';
import { I18nKey } from './i18n';

/**
 * The weight card and the BMI gauge (design reference: Home Workout's Report
 * tab, adopted 2026-08-13).
 *
 * Everything here is arithmetic on the reader's own entries plus their stated
 * height. Nothing is estimated: the competitor's Report tab leads with a
 * calorie counter, and a kcal number the app cannot measure is exactly the kind
 * of invented figure the rest of this codebase refuses to print.
 */

export interface BodyweightCardStats {
  /** Most recent entry by date. Null when nothing is logged. */
  currentKg: number | null;
  heaviestKg: number | null;
  lightestKg: number | null;
  /** Entries ever logged — the card shows its empty state at 0. */
  count: number;
}

/** Local midnight for an ISO timestamp — the day the reader stood on the scale. */
function dayStartOf(recordedAt: string): number {
  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) {
    return Number.NaN;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * One weigh-in per day — the last one entered wins.
 *
 * A day has one weight. Logging 75 in the morning and 71 in the evening is a
 * correction, not two data points, and treating it as two made the earlier
 * number a permanent record: 75 stayed "heaviest" forever even though the
 * reader had already replaced it. After collapsing, that day is 71 and 71 is
 * both the heaviest and the lightest, which is what the reader meant.
 *
 * Ties on the exact same timestamp keep the later ARRAY position, because that
 * is the one that was written second.
 */
export function collapseToLatestPerDay(entries: readonly BodyweightEntry[]): BodyweightEntry[] {
  const byDay = new Map<number, BodyweightEntry>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      continue;
    }
    const day = dayStartOf(entry.recordedAt);
    if (Number.isNaN(day)) {
      continue;
    }
    const held = byDay.get(day);
    if (!held || Date.parse(entry.recordedAt) >= Date.parse(held.recordedAt)) {
      byDay.set(day, entry);
    }
  }
  return [...byDay.entries()].sort(([left], [right]) => left - right).map(([, entry]) => entry);
}

export function buildBodyweightCardStats(entries: readonly BodyweightEntry[]): BodyweightCardStats {
  const usable = collapseToLatestPerDay(entries);
  if (usable.length === 0) {
    return { currentKg: null, heaviestKg: null, lightestKg: null, count: 0 };
  }

  // "Current" is the latest by DATE, not the last in the array. Entries arrive
  // from storage in whatever order they were written, and a back-dated weigh-in
  // added after today's would otherwise become "current".
  let latest = usable[0];
  let heaviest = usable[0].weight;
  let lightest = usable[0].weight;
  for (const entry of usable) {
    if (Date.parse(entry.recordedAt) > Date.parse(latest.recordedAt)) {
      latest = entry;
    }
    heaviest = Math.max(heaviest, entry.weight);
    lightest = Math.min(lightest, entry.weight);
  }

  return { currentKg: latest.weight, heaviestKg: heaviest, lightestKg: lightest, count: usable.length };
}

/** WHO bands, in the order the gauge paints them left to right. */
export type BmiBandKey = 'severe' | 'moderate' | 'mild' | 'healthy' | 'over' | 'obese1' | 'obese2';

export interface BmiBand {
  key: BmiBandKey;
  /** Inclusive lower bound; the first band has none. */
  from: number | null;
  /** Exclusive upper bound; the last band has none. */
  to: number | null;
  labelKey: I18nKey;
  color: string;
}

/**
 * The gauge's stops are the WHO cut-offs the reference prints under the bar:
 * 15, 16, 18.5, 25, 30, 35, 40. The bar is drawn in EQUAL segments rather than
 * to scale — 18.5–25 is six and a half points wide and 15–16 is one, and a
 * true-to-scale bar makes the two underweight bands invisible slivers.
 */
export const BMI_BANDS: BmiBand[] = [
  { key: 'severe', from: null, to: 15, labelKey: 'bmi.band.severe', color: '#1E40AF' },
  { key: 'moderate', from: 15, to: 16, labelKey: 'bmi.band.moderate', color: '#3B82F6' },
  { key: 'mild', from: 16, to: 18.5, labelKey: 'bmi.band.mild', color: '#60A5FA' },
  { key: 'healthy', from: 18.5, to: 25, labelKey: 'bmi.band.healthy', color: '#2DD4BF' },
  { key: 'over', from: 25, to: 30, labelKey: 'bmi.band.over', color: '#FBBF24' },
  { key: 'obese1', from: 30, to: 35, labelKey: 'bmi.band.obese1', color: '#F59E0B' },
  { key: 'obese2', from: 35, to: null, labelKey: 'bmi.band.obese2', color: '#EF4444' },
];

/**
 * The INTERNAL boundaries only — the value where one band ends and the next
 * begins, so tick i belongs at x = (i + 1) * segment.
 *
 * The first version listed 40 here too and drew every tick at i * segment. That
 * put 15 under the left edge of the "below 15" band instead of under its right
 * edge, shifting the whole scale one band left: a BMI of 24.7 landed correctly
 * at the top of the healthy band while the number printed under the marker read
 * 30. And 40 came out twice, once shifted and once at the end.
 */
export const BMI_SCALE_TICKS = [15, 16, 18.5, 25, 30, 35];
/** Printed at the far right end of the bar, past the last boundary. */
export const BMI_SCALE_MAX_TICK = 40;

/**
 * Evenly spaced y-axis ticks for the weight curve.
 *
 * The chart's own default is four ticks over a range padded by 18 %, which on
 * body weight reads as a coarse ruler: the reference prints seven, 0.2 kg
 * apart, and that resolution is the point — the thing being watched moves by
 * tenths, and an axis that steps by whole kilos hides it.
 *
 * A flat series (one entry, or a week at the same weight) has no range to
 * divide, so it gets a fixed window around the value instead of collapsing to
 * a single line.
 */
/** Steps a person reads without thinking. No 0.1333 kg gridlines. */
const NICE_STEPS = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];

export function buildWeightAxisTicks(values: readonly number[], tickCount = 7): number[] {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0 || tickCount < 2) {
    return [];
  }

  const rawMin = Math.min(...usable);
  const rawMax = Math.max(...usable);
  const span = rawMax - rawMin;
  // 0.6 kg around a single weigh-in, a third tighter than the first version's
  // 1.2 — that one spread one entry over an axis wide enough to hide the next
  // week's change inside a single gridline gap.
  // Snap the STEP, not the endpoints. Dividing a padded range into six equal
  // parts and rounding each label to one decimal is what produced 75.9, 75.8,
  // 75.6, 75.5, 75.4, 75.2, 75.1 — evenly spaced lines under labels that read
  // as though they were not.
  //
  // Divided by tickCount - 2 rather than - 1, which buys half a step of clear
  // air above the highest value and below the lowest: a dot welded to the top
  // gridline reads as clipped.
  const rawStep = Math.max(span / (tickCount - 2), 0.6 / (tickCount - 1));
  const step = NICE_STEPS.find((candidate) => candidate >= rawStep) ?? rawStep;

  // Centred on the data, so a flat series sits on the middle gridline.
  const centre = (rawMax + rawMin) / 2;
  const top = centre + (step * (tickCount - 1)) / 2;

  return Array.from({ length: tickCount }, (_, index) => Number((top - step * index).toFixed(2)));
}

export interface WeightWindowDay {
  /** Local midnight. */
  dayStart: number;
  /** Day of month, the axis label. */
  label: string;
  /** The day's weight, or null when nothing was logged. */
  value: number | null;
  isToday: boolean;
}

/**
 * The chart's x-axis: a fixed run of CALENDAR days with today in the middle.
 *
 * The axis is dates, not entries. Plotting entry-by-entry spaced them evenly
 * however far apart they actually were, so a weigh-in on Monday and the next
 * one three weeks later sat side by side as if they were consecutive. Here a
 * day with no entry is a gap in the line and keeps its slot, which is the only
 * way the slope means anything.
 *
 * Today in the middle, not at the right edge, so the first weigh-in a reader
 * ever logs lands in the centre of the card rather than pinned to one end.
 */
export function buildWeightWindow(
  entries: readonly BodyweightEntry[],
  nowMs: number,
  days = 7,
): WeightWindowDay[] {
  const now = new Date(nowMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const byDay = new Map(collapseToLatestPerDay(entries).map((entry) => [dayStartOf(entry.recordedAt), entry]));
  const half = Math.floor(days / 2);

  return Array.from({ length: days }, (_, index) => {
    // Built by calendar arithmetic, not by adding 86 400 000 ms: a DST change
    // inside the window would otherwise slide every later day by an hour and
    // drop one of them onto the wrong slot.
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - half + index);
    const dayStart = date.getTime();
    return {
      dayStart,
      label: String(date.getDate()),
      value: byDay.get(dayStart)?.weight ?? null,
      isToday: dayStart === today,
    };
  });
}

/**
 * The same calendar-days window, for any dated value — a tape measurement, a
 * body-fat reading, or the weight itself on the trends tab. The other charts
 * spaced entries evenly, and the user's verdict was blunt: every grid should
 * look identical to the weight one (2026-08-25). Identical starts at the
 * axis: calendar days, where a gap keeps its slot.
 *
 * Backward-looking (ends today) rather than centred like the weight card's
 * week: a history over months is read as "how did I get here".
 */
export function buildValueWindow(
  entries: ReadonlyArray<{ recordedAt: string; value: number }>,
  nowMs: number,
  days: number,
): WeightWindowDay[] {
  const now = new Date(nowMs);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  // Latest reading of each day wins, same rule as the weigh-ins.
  const byDay = new Map<number, number>();
  const byDayAt = new Map<number, number>();
  for (const entry of entries) {
    const day = dayStartOf(entry.recordedAt);
    const at = new Date(entry.recordedAt).getTime();
    if (!byDayAt.has(day) || at >= (byDayAt.get(day) ?? 0)) {
      byDay.set(day, entry.value);
      byDayAt.set(day, at);
    }
  }
  const span = Math.max(2, Math.round(days));
  /**
   * Bare day inside a fortnight, day.month beyond it.
   *
   * Both halves of this are a user verdict from the same day (2026-08-25). A
   * bare day-of-month axis over three months read "26 30 3 7 11" — a number
   * sequence rather than a calendar. But dates over a WEEK read as clutter
   * next to the weight card's "22 23 24 25 26 27 28", which is the axis the
   * user pointed at and asked every other chart to copy. Inside two weeks the
   * month cannot change more than once, so the day alone is unambiguous.
   */
  const withMonth = span > 14;
  return Array.from({ length: span }, (_, index) => {
    // Calendar arithmetic, not +86 400 000 ms — DST would slide the slots.
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (span - 1) + index);
    const dayStart = date.getTime();
    return {
      dayStart,
      label: withMonth ? `${date.getDate()}.${date.getMonth() + 1}.` : String(date.getDate()),
      value: byDay.get(dayStart) ?? null,
      isToday: dayStart === today,
    };
  });
}

export function calculateBmi(weightKg: number, heightCm: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  const metres = heightCm / 100;
  const bmi = weightKg / (metres * metres);
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
}

export function bmiBand(bmi: number): BmiBand {
  return (
    BMI_BANDS.find((band) => (band.from === null || bmi >= band.from) && (band.to === null || bmi < band.to)) ??
    BMI_BANDS[BMI_BANDS.length - 1]
  );
}

/**
 * Where the marker sits, 0..1 across the whole bar.
 *
 * Within a band the position is interpolated, so 19 and 24 do not both point at
 * the middle of "healthy". The open-ended end bands are given the width of
 * their neighbour so the marker still has somewhere to travel: a BMI of 12 and
 * a BMI of 14.9 must not stack on the same pixel.
 */
export function bmiMarkerPosition(bmi: number): number {
  const segment = 1 / BMI_BANDS.length;
  const index = BMI_BANDS.findIndex((band) => band.key === bmiBand(bmi).key);
  const band = BMI_BANDS[index];

  const from = band.from ?? (band.to !== null ? band.to - 3 : 0);
  const to = band.to ?? (band.from !== null ? band.from + 5 : 1);
  const within = to === from ? 0.5 : (bmi - from) / (to - from);

  return Math.min(1, Math.max(0, (index + Math.min(1, Math.max(0, within))) * segment));
}
