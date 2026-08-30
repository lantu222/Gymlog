import { calendarDaysBetween } from './completedSessions';
import { I18nKey, t } from './i18n';
import { getTopComparableSet } from './profileOverview';
import { ExerciseProgressSummary } from './progression';
import { AppLanguage, BodyweightEntry, MeasurementEntry, MeasurementKind } from '../types/models';
import { removeTrailingZeros } from './format';

/**
 * "Your cards" — user-pinned stat cards at the bottom of Home.
 *
 * Every card is computed from the user's own history; there is no seed or
 * placeholder data. A pinned card whose source has no entries yet says so
 * instead of drawing an invented trend.
 */

export type HomeStatCardIcon = 'scale' | 'drop' | 'lift' | 'tape';

export interface HomeStatCardCatalogItem {
  key: string;
  label: string;
  unit: string;
  icon: HomeStatCardIcon;
}

export interface HomeStatCard extends HomeStatCardCatalogItem {
  /** Latest value, null when the source has no entries yet. */
  value: number | null;
  /** The result before the latest one; null when under 2 points. */
  previous: number | null;
  /** Reps of the latest top set — lifts only. */
  reps: number | null;
  /** Oldest→newest, at most SERIES_POINTS values. */
  series: number[];
  /** When the latest point was logged (ms since epoch); null with no entries. */
  recordedAt: number | null;
  /**
   * Change per week across the sparkline window, in the card's unit. Null
   * until the window's ends are at least TREND_MIN_SPAN_DAYS apart — two
   * weigh-ins a day apart projected to "per week" is a guess wearing a
   * number.
   */
  weeklyTrend: number | null;
}

export interface HomeStatCardSources {
  bodyweightEntries: BodyweightEntry[];
  measurementEntries: MeasurementEntry[];
  trackedProgress: ExerciseProgressSummary[];
}

/** Points shown in a sparkline — roughly "recent memory", not all history. */
export const SERIES_POINTS = 7;

/** A weekly rate needs at least a week of calendar behind it. */
export const TREND_MIN_SPAN_DAYS = 7;

/** One sparkline point with the moment it was logged. */
interface SeriesPoint {
  value: number;
  at: number;
}

/** Tracked lifts offered in the Add sheet, heaviest first. */
const MAX_LIFT_CATALOG_ITEMS = 8;

export const DEFAULT_HOME_STAT_CARD_KEYS = ['bodyweight'];

/** Tape measurements, in the order the measurement screen lists them. */
export const MEASUREMENT_CARD_KINDS: MeasurementKind[] = [
  'shoulders',
  'chest',
  'arms',
  'waist',
  'hips',
  'thighs',
  'calves',
];

/** Every card key whose data lives on the measurement screen. */
export function isMeasurementCardKey(key: string): boolean {
  return key === 'bodyfat' || (MEASUREMENT_CARD_KINDS as string[]).includes(key);
}

export const MEASUREMENT_LABEL_KEYS: Record<MeasurementKind, I18nKey> = {
  bodyfat: 'progress.measure.bodyfat',
  shoulders: 'progress.measure.shoulders',
  chest: 'progress.measure.chest',
  arms: 'progress.measure.arms',
  waist: 'progress.measure.waist',
  hips: 'progress.measure.hips',
  thighs: 'progress.measure.thighs',
  calves: 'progress.measure.calves',
};

const LIFT_KEY_PREFIX = 'lift:';

function liftCardKey(progressKey: string) {
  return `${LIFT_KEY_PREFIX}${progressKey}`;
}

/**
 * The full catalog for this user: fixed body metrics plus their own tracked
 * lifts. Lift labels come from the user's logged names, so a Finnish
 * "Takakyykky" is offered as-is instead of failing an English name match.
 */
export function buildHomeStatCardCatalog(
  sources: HomeStatCardSources,
  language: AppLanguage = 'en',
): HomeStatCardCatalogItem[] {
  const lifts = sources.trackedProgress
    .filter((summary) => summary.bestWeight !== null && summary.bestWeight > 0)
    .sort((left, right) => (right.bestWeight ?? 0) - (left.bestWeight ?? 0))
    .slice(0, MAX_LIFT_CATALOG_ITEMS)
    .map((summary) => ({
      key: liftCardKey(summary.key),
      label: summary.name,
      unit: 'kg',
      icon: 'lift' as const,
    }));

  // Every measurement Progress tracks, not three of the six. The Add sheet
  // offered bodyweight, body fat and waist while the measurement screen logged
  // shoulders, chest, hips and thighs too — so a reader who measures their
  // chest every week could not put that number on Home.
  //
  // Labels come from the measurement screen's own keys rather than a second
  // set of `cards.*` strings, so the two surfaces cannot end up calling the
  // same tape measure different things.
  return [
    { key: 'bodyweight', label: t(language, 'cards.bodyweight'), unit: 'kg', icon: 'scale' },
    { key: 'bodyfat', label: t(language, 'cards.bodyfat'), unit: '%', icon: 'drop' },
    ...MEASUREMENT_CARD_KINDS.map((kind) => ({
      key: kind,
      label: t(language, MEASUREMENT_LABEL_KEYS[kind]),
      unit: 'cm',
      icon: 'tape' as const,
    })),
    ...lifts,
  ];
}

function sortByRecordedAt<T extends { recordedAt: string }>(entries: T[]): T[] {
  return [...entries].sort(
    (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
  );
}

function weeklyTrendOf(points: SeriesPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const spanDays = calendarDaysBetween(first.at, last.at);
  if (spanDays < TREND_MIN_SPAN_DAYS) {
    return null;
  }
  return ((last.value - first.value) / spanDays) * 7;
}

function buildSeriesCard(item: HomeStatCardCatalogItem, points: SeriesPoint[], reps: number | null = null): HomeStatCard {
  const series = points.map((point) => point.value);
  const value = series.length > 0 ? series[series.length - 1] : null;
  const previous = series.length >= 2 ? series[series.length - 2] : null;
  const recordedAt = points.length > 0 ? points[points.length - 1].at : null;

  return { ...item, value, previous, reps, series, recordedAt, weeklyTrend: weeklyTrendOf(points) };
}

function liftSeries(summary: ExerciseProgressSummary): { points: SeriesPoint[]; reps: number | null } {
  // logs arrive newest-first from progression.ts; the sparkline wants oldest→newest.
  const chronological = [...summary.logs].sort(
    (left, right) => new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime(),
  );

  const points: Array<{ weight: number; reps: number; at: number }> = [];
  for (const log of chronological) {
    const topSet = getTopComparableSet(log);
    if (topSet !== null && topSet.weight > 0) {
      points.push({ weight: topSet.weight, reps: topSet.reps, at: new Date(log.performedAt).getTime() });
    }
  }

  const window = points.slice(-SERIES_POINTS);
  return {
    points: window.map((point) => ({ value: point.weight, at: point.at })),
    reps: window.length > 0 ? window[window.length - 1].reps : null,
  };
}

/**
 * Resolve the pinned keys into renderable cards. Unknown keys (for example a
 * lift whose logs were reset) are dropped silently — the pin list is a
 * preference, not data.
 */
export function buildHomeStatCards(
  pinnedKeys: string[],
  sources: HomeStatCardSources,
  language: AppLanguage = 'en',
): HomeStatCard[] {
  const catalog = new Map(buildHomeStatCardCatalog(sources, language).map((item) => [item.key, item]));
  const cards: HomeStatCard[] = [];

  for (const key of pinnedKeys) {
    const item = catalog.get(key);
    if (!item) {
      continue;
    }

    if (key === 'bodyweight') {
      const points = sortByRecordedAt(sources.bodyweightEntries)
        .map((entry) => ({ value: entry.weight, at: new Date(entry.recordedAt).getTime() }))
        .slice(-SERIES_POINTS);
      cards.push(buildSeriesCard(item, points));
      continue;
    }

    if (isMeasurementCardKey(key)) {
      const points = sortByRecordedAt(
        sources.measurementEntries.filter((entry) => entry.kind === key),
      )
        .map((entry) => ({ value: entry.value, at: new Date(entry.recordedAt).getTime() }))
        .slice(-SERIES_POINTS);
      cards.push(buildSeriesCard(item, points));
      continue;
    }

    const summary = sources.trackedProgress.find((candidate) => liftCardKey(candidate.key) === key);
    if (summary) {
      const { points, reps } = liftSeries(summary);
      cards.push(buildSeriesCard(item, points, reps));
    }
  }

  return cards;
}

/**
 * Stored preference → usable pin list. `null` means the user has never touched
 * the section (→ default); an empty array means they removed every card and
 * that choice is respected.
 */
export function resolveHomeStatCardKeys(stored: string[] | null): string[] {
  if (stored === null) {
    return [...DEFAULT_HOME_STAT_CARD_KEYS];
  }

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const key of stored) {
    if (typeof key === 'string' && key.length > 0 && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }
  return keys;
}

export function formatHomeStatValue(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return removeTrailingZeros(Math.round(value * 10) / 10);
}

/**
 * "2 days ago" — how old the number on the card is. Beyond two weeks the
 * phrase stops being shorter than the truth, so the date itself takes over.
 */
export function formatHomeStatRecency(
  recordedAt: number,
  language: AppLanguage = 'en',
  now: Date = new Date(),
): string {
  const days = calendarDaysBetween(recordedAt, now);
  if (days <= 0) {
    return t(language, 'cards.when.today');
  }
  if (days === 1) {
    return t(language, 'cards.when.yesterday');
  }
  if (days < 7) {
    return t(language, 'cards.when.daysAgo', { days });
  }
  if (days < 14) {
    return t(language, 'cards.when.lastWeek');
  }
  const date = new Date(recordedAt);
  return t(language, 'cards.when.onDate', { day: date.getDate(), month: date.getMonth() + 1 });
}

/** "−0.4 / wk" — the sign always shown, so the direction needs no chart. */
export function formatHomeStatTrend(weeklyTrend: number, language: AppLanguage = 'en'): string {
  const rounded = Math.round(weeklyTrend * 10) / 10;
  const magnitude = removeTrailingZeros(Math.abs(rounded));
  const signed = rounded > 0 ? '+' + magnitude : rounded < 0 ? '−' + magnitude : magnitude;
  return t(language, 'cards.trendPerWeek', { trend: signed });
}
