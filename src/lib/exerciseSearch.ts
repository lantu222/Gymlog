/**
 * What a library search matches against.
 *
 * The library screen showed "Takakyykky" and searched "kyykky" against
 * "Barbell Squat" — zero results, on the one screen whose job is finding
 * lifts. Three screens each kept their own copy of this haystack and only one
 * of them had thought to include the Finnish name. One builder now, and it
 * carries both spellings of everything the reader can see: the exercise name
 * and its translation, and the body part, category and equipment in both the
 * data's English and the label the screen prints.
 */
import { exerciseNameLabel } from './exerciseNameLabel';
import { libraryLabel } from './libraryLabel';
import { AppLanguage, ExerciseLibraryItem } from '../types/models';

export function buildExerciseSearchHaystack(
  item: Pick<ExerciseLibraryItem, 'name' | 'bodyPart' | 'category' | 'equipment' | 'primaryMuscles' | 'secondaryMuscles'>,
  language: AppLanguage,
): string {
  const facets: string[] = [item.bodyPart, item.category, item.equipment].filter((value) => Boolean(value));
  return [
    item.name,
    exerciseNameLabel(language, item.name),
    ...facets,
    ...facets.map((facet) => libraryLabel(facet, language)),
    ...(item.primaryMuscles ?? []),
    ...(item.secondaryMuscles ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

/** True when every whitespace-separated term of the query appears in the haystack. */
export function exerciseMatchesQuery(haystack: string, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => haystack.includes(term));
}

/**
 * How well a match answers the query, lower is better.
 *
 * Matching alone is not enough: the empty workout listed its matches in the
 * English name's alphabetical order, so "ylätal" put Kapea ylätalja and
 * Soutu ylätaljasta korokkeelta first and the plain lat pulldown twelfth
 * ("haluisin vain ylätalja — huonot suositukset", #bugs 2026-08-28). The
 * name the reader is looking at is what they typed a piece of, so it is
 * ranked first: the name as typed, then a name that begins with it, then a
 * name with a word that begins with it, then a name that merely contains it,
 * and last a row that matched on a facet only.
 */
export function rankExerciseMatch(
  item: Pick<ExerciseLibraryItem, 'name' | 'bodyPart' | 'category' | 'equipment' | 'primaryMuscles' | 'secondaryMuscles'>,
  query: string,
  language: AppLanguage,
): number {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return 0;
  }
  const shown = exerciseNameLabel(language, item.name).toLowerCase();
  const stored = item.name.toLowerCase();
  if (shown === needle || stored === needle) {
    return 0;
  }
  if (shown.startsWith(needle)) {
    return 1;
  }
  if (shown.split(/[\s\-–(]+/).some((word) => word.startsWith(needle))) {
    return 2;
  }
  if (shown.includes(needle) || stored.includes(needle)) {
    return 3;
  }
  return 4;
}

/**
 * The matches for a query, best answer first. Stable within a rank, so the
 * caller's order (popularity, alphabet) still decides between equals; a
 * shorter name outranks a longer one at the same rank because it is the
 * plainer version of the same lift.
 */
export function rankExerciseMatches<
  T extends Pick<ExerciseLibraryItem, 'name' | 'bodyPart' | 'category' | 'equipment' | 'primaryMuscles' | 'secondaryMuscles'>,
>(items: readonly T[], query: string, language: AppLanguage): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...items];
  }
  return items
    .map((item, index) => ({ item, index, rank: rankExerciseMatch(item, needle, language), length: exerciseNameLabel(language, item.name).length }))
    .filter(({ item }) => exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), needle))
    .sort((left, right) => left.rank - right.rank || left.length - right.length || left.index - right.index)
    .map(({ item }) => item);
}
