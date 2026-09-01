import { AppLanguage } from '../types/models';

/**
 * A family of programmes, read as a ladder rather than a list.
 *
 * Twenty-one rows that differ by one day and one lift each are not a list you
 * scan — they are steps, and the reader's question is "which step am I on".
 * Everything here serves that: an order they can change, a line saying what
 * each row costs per week, and one row that knows something about them.
 */

export type ProgramLadderSort = 'recommended' | 'days' | 'length';

export interface ProgramLadderRow {
  id: string;
  days: number;
  minutes: number;
  weeks: number;
  level: string;
}

/**
 * What a week of this programme costs: "4 × 55 min = 3 h 40 / wk".
 *
 * The sheet used to print days, minutes and weeks as three separate facts,
 * two of which every row in a family shares. What differs between steps is the
 * total — and nobody multiplies in their head while browsing.
 */
export function formatWeeklyLoad(days: number, minutes: number, language: AppLanguage = 'en'): string {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 0;
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
  const total = safeDays * safeMinutes;
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  const perWeek = language === 'fi' ? '/ vk' : '/ wk';
  // Under an hour a week reads as minutes; "0 h 45" is arithmetic, not an
  // amount of training.
  const amount = hours > 0 ? `${hours} h${rest ? ` ${rest}` : ''}` : `${rest} min`;
  return `${safeDays} × ${safeMinutes} min = ${amount} ${perWeek}`;
}

/**
 * The one row that knows the reader: it fits the week they said they have.
 *
 * Exact match only. A four-day programme offered to someone who said three is
 * not a recommendation, it is a guess wearing a badge — and the badge is the
 * only thing on this sheet that claims to know anything about them. Returns
 * null rather than falling back to the first row, because "recommended"
 * pointing at whatever happened to sort first is worse than no recommendation.
 */
export function pickRecommendedProgram<T extends ProgramLadderRow>(
  rows: readonly T[],
  daysPerWeek: number | null | undefined,
): T | null {
  if (!daysPerWeek || !Number.isFinite(daysPerWeek)) {
    return null;
  }
  return rows.find((row) => row.days === daysPerWeek) ?? null;
}

/**
 * The ladder, in the order the reader asked for.
 *
 * 'recommended' keeps the catalog's own order and floats the fitting row to
 * the top — the catalog order IS the family's ladder, so re-sorting it by
 * anything is the reader overriding a recommendation, not correcting one.
 * Never mutates the input.
 */
export function sortProgramLadder<T extends ProgramLadderRow>(
  rows: readonly T[],
  sort: ProgramLadderSort,
  recommended: T | null,
): T[] {
  if (sort === 'days') {
    return [...rows].sort((left, right) => left.days - right.days || left.id.localeCompare(right.id));
  }
  if (sort === 'length') {
    return [...rows].sort((left, right) => left.weeks - right.weeks || left.id.localeCompare(right.id));
  }
  if (!recommended) {
    return [...rows];
  }
  return [recommended, ...rows.filter((row) => row.id !== recommended.id)];
}

/**
 * The sorts that can actually reorder what is on screen.
 *
 * Block length is 8 or 12 weeks and nothing else, so in half the sheet's
 * views — measured: 14 of 28 category × level combinations, including all
 * eleven rows of Focus — every row is the same length and a "Length" chip is
 * a control that visibly does nothing when tapped. Days goes flat in five.
 *
 * 'recommended' is always offered: it is the default and the way back from
 * either of the others, so it stays even when it moves nothing.
 */
export function availableLadderSorts<T extends ProgramLadderRow>(
  rows: readonly T[],
): ProgramLadderSort[] {
  const distinct = (pick: (row: T) => number) =>
    new Set(rows.map(pick).filter((value) => Number.isFinite(value) && value > 0)).size > 1;

  const sorts: ProgramLadderSort[] = ['recommended'];
  if (distinct((row) => row.days)) {
    sorts.push('days');
  }
  if (distinct((row) => row.weeks)) {
    sorts.push('length');
  }
  return sorts;
}

/**
 * Whether a row's level badge says anything the filter has not.
 *
 * With "Advanced" selected, an ADVANCED badge on all eleven rows is eleven
 * repetitions of the reader's own choice. The badge is for the rows that
 * differ from what was asked for — which, with no filter on, is all of them.
 */
export function shouldShowLevelBadge(
  rowLevel: string,
  activeFilter: string | null | undefined,
): boolean {
  if (!activeFilter) {
    return true;
  }
  return rowLevel !== activeFilter;
}
