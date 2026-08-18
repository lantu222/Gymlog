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
