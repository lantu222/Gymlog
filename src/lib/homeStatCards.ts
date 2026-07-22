import { getTopComparableSet } from './profileOverview';
import { ExerciseProgressSummary } from './progression';
import { BodyweightEntry, MeasurementEntry } from '../types/models';

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
}

export interface HomeStatCardSources {
  bodyweightEntries: BodyweightEntry[];
  measurementEntries: MeasurementEntry[];
  trackedProgress: ExerciseProgressSummary[];
}

/** Points shown in a sparkline — roughly "recent memory", not all history. */
export const SERIES_POINTS = 7;

/** Tracked lifts offered in the Add sheet, heaviest first. */
const MAX_LIFT_CATALOG_ITEMS = 8;

export const DEFAULT_HOME_STAT_CARD_KEYS = ['bodyweight'];

const LIFT_KEY_PREFIX = 'lift:';

function liftCardKey(progressKey: string) {
  return `${LIFT_KEY_PREFIX}${progressKey}`;
}

/**
 * The full catalog for this user: fixed body metrics plus their own tracked
 * lifts. Lift labels come from the user's logged names, so a Finnish
 * "Takakyykky" is offered as-is instead of failing an English name match.
 */
export function buildHomeStatCardCatalog(sources: HomeStatCardSources): HomeStatCardCatalogItem[] {
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

  return [
    { key: 'bodyweight', label: 'Body weight', unit: 'kg', icon: 'scale' },
    { key: 'bodyfat', label: 'Body fat', unit: '%', icon: 'drop' },
    { key: 'waist', label: 'Waist', unit: 'cm', icon: 'tape' },
    ...lifts,
  ];
}

function sortByRecordedAt<T extends { recordedAt: string }>(entries: T[]): T[] {
  return [...entries].sort(
    (left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
  );
}

function buildSeriesCard(item: HomeStatCardCatalogItem, series: number[], reps: number | null = null): HomeStatCard {
  const value = series.length > 0 ? series[series.length - 1] : null;
  const previous = series.length >= 2 ? series[series.length - 2] : null;

  return { ...item, value, previous, reps, series };
}

function liftSeries(summary: ExerciseProgressSummary): { series: number[]; reps: number | null } {
  // logs arrive newest-first from progression.ts; the sparkline wants oldest→newest.
  const chronological = [...summary.logs].sort(
    (left, right) => new Date(left.performedAt).getTime() - new Date(right.performedAt).getTime(),
  );

  const points: Array<{ weight: number; reps: number }> = [];
  for (const log of chronological) {
    const topSet = getTopComparableSet(log);
    if (topSet !== null && topSet.weight > 0) {
      points.push({ weight: topSet.weight, reps: topSet.reps });
    }
  }

  const window = points.slice(-SERIES_POINTS);
  return {
    series: window.map((point) => point.weight),
    reps: window.length > 0 ? window[window.length - 1].reps : null,
  };
}

/**
 * Resolve the pinned keys into renderable cards. Unknown keys (for example a
 * lift whose logs were reset) are dropped silently — the pin list is a
 * preference, not data.
 */
export function buildHomeStatCards(pinnedKeys: string[], sources: HomeStatCardSources): HomeStatCard[] {
  const catalog = new Map(buildHomeStatCardCatalog(sources).map((item) => [item.key, item]));
  const cards: HomeStatCard[] = [];

  for (const key of pinnedKeys) {
    const item = catalog.get(key);
    if (!item) {
      continue;
    }

    if (key === 'bodyweight') {
      const series = sortByRecordedAt(sources.bodyweightEntries)
        .map((entry) => entry.weight)
        .slice(-SERIES_POINTS);
      cards.push(buildSeriesCard(item, series));
      continue;
    }

    if (key === 'bodyfat' || key === 'waist') {
      const series = sortByRecordedAt(
        sources.measurementEntries.filter((entry) => entry.kind === key),
      )
        .map((entry) => entry.value)
        .slice(-SERIES_POINTS);
      cards.push(buildSeriesCard(item, series));
      continue;
    }

    const summary = sources.trackedProgress.find((candidate) => liftCardKey(candidate.key) === key);
    if (summary) {
      const { series, reps } = liftSeries(summary);
      cards.push(buildSeriesCard(item, series, reps));
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
  return `${Math.round(value * 10) / 10}`;
}
