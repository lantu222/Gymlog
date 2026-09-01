import { ProgramCategoryKey } from './programCategories';
import { WorkoutLevel } from '../features/workout/workoutTypes';

/**
 * The catalog screen: 57 ready programmes, narrowed three ways.
 *
 * The goal discs on the Programs tab are a taxonomy — nine doors, each opening
 * a fixed slice. They cannot answer "a four-day muscle programme I can start
 * as a beginner", because that question crosses two of them. This is the door
 * the brief added for that: level, goal and free text, all narrowing the same
 * list at once.
 */

export interface ProgramCatalogRow {
  id: string;
  name: string;
  blurb: string;
  level: WorkoutLevel;
  /** The categories this programme belongs to — a programme can be in several. */
  categories: readonly ProgramCategoryKey[];
}

export interface ProgramCatalogQuery {
  level: WorkoutLevel | null;
  goal: ProgramCategoryKey | null;
  search: string;
}

export const EMPTY_CATALOG_QUERY: ProgramCatalogQuery = { level: null, goal: null, search: '' };

/**
 * Loose enough to survive how people actually type a programme's name.
 *
 * The catalog is full of names like "HUGE Pro+" and "Strength Foundations
 * 5x5". Someone hunting for the second one types "5x5" or "strength
 * foundations"; someone hunting the first types "huge pro". Case and the gaps
 * between words are the two things that must not matter, so both sides are
 * lowercased and their runs of whitespace collapsed.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Whether one row survives the query. Every clause is AND: the reader adding a
 * filter is always narrowing, never widening.
 */
export function matchesCatalogQuery(row: ProgramCatalogRow, query: ProgramCatalogQuery): boolean {
  if (query.level && row.level !== query.level) {
    return false;
  }
  if (query.goal && !row.categories.includes(query.goal)) {
    return false;
  }
  const needle = normalize(query.search);
  if (!needle) {
    return true;
  }
  // Name first, then the sentence under it: someone typing "beginner" is
  // describing a programme, not naming one, and the blurbs say so.
  return normalize(row.name).includes(needle) || normalize(row.blurb).includes(needle);
}

export function filterProgramCatalog<T extends ProgramCatalogRow>(
  rows: readonly T[],
  query: ProgramCatalogQuery,
): T[] {
  return rows.filter((row) => matchesCatalogQuery(row, query));
}

export function isCatalogQueryEmpty(query: ProgramCatalogQuery): boolean {
  return !query.level && !query.goal && !normalize(query.search);
}
