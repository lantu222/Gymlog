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
import { displayEquipmentValue, libraryLabel } from './libraryLabel';
import { AppLanguage, ExerciseLibraryItem } from '../types/models';

export function buildExerciseSearchHaystack(
  item: Pick<
    ExerciseLibraryItem,
    'name' | 'bodyPart' | 'category' | 'equipment' | 'sourceEquipment' | 'primaryMuscles' | 'secondaryMuscles'
  >,
  language: AppLanguage,
): string {
  // Both the bucket and the word the row prints. They differ for the 54
  // kettlebell exercises, which are filed under `dumbbell` but say
  // "Kahvakuula" on screen — and a haystack that carries only the bucket
  // makes 15 of them unfindable by the word the reader is looking at, Goblet
  // Squat among them. A Set because they are the same value for everything
  // else, and a duplicated facet would be a duplicated label too.
  const facets: string[] = [
    ...new Set([item.bodyPart, item.category, item.equipment, displayEquipmentValue(item)]),
  ].filter((value) => Boolean(value));
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

/**
 * Text as search compares it: lower case, ä/ö/å folded to a/o/a, and
 * hyphens, dashes, brackets and runs of spaces all one space.
 *
 * "Joskus liikkeen nimeäminen on niin sana tarkkaa, jokainen väli pitää olla
 * oikein muuten ei löydä" (#bugs 2026-09-27): "trap bar" missed "Trap bar
 * -maastaveto" on the dash, and a keyboard without ä could not type "ylä".
 */
const normalizedCache = new Map<string, string>();

export function normalizeSearchText(value: string): string {
  // A stored row with no name must not throw on every keystroke — the crash
  // class the name guards in this file's callers exist for (PR review).
  if (typeof value !== 'string') {
    return '';
  }
  // Library labels and facets repeat on every keystroke of every sheet; a
  // bounded memo keeps the fold to once per string.
  const cached = normalizedCache.get(value);
  if (cached !== undefined) {
    return cached;
  }
  const normalized = foldSearchText(value);
  if (normalizedCache.size > 20000) {
    normalizedCache.clear();
  }
  normalizedCache.set(value, normalized);
  return normalized;
}

function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[-–—_/(),.:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The gym's own words for lifts the library names otherwise, folded like
 * everything else. "Eikö ole yläpenkkiä?" (#bugs 2026-09-27) — it was there,
 * as "Vinopenkkipunnerrus". Kept to words a Finnish gym actually says; a
 * term here widens every search that contains it.
 */
const SEARCH_ALIASES: Record<string, readonly string[]> = {
  ylapenkki: ['vinopenkki'],
  ylaviistopenkki: ['vinopenkki'],
  alapenkki: ['laskeva penkki'],
  alaviistopenkki: ['laskeva penkki'],
  penkkari: ['penkkipunnerrus'],
  kp: ['kasipaino'],
  // The short forms the rows print (exerciseListLabel) find what they stand for.
  kk: ['kahvakuula'],
  smithissa: ['smith'],
  mave: ['maastaveto'],
  leuka: ['leuanveto'],
  leuat: ['leuanveto'],
  // The app's supinated grip is `alaote` (Leuanveto alaotteella); the gym also says vastaote.
  // The stem, not the word: alaote / alaotteella differ in the consonant.
  vastaote: ['alaot'],
  vastaotteella: ['alaot'],
};

/** A term and the words it also stands for. */
function termVariants(term: string): string[] {
  return [term, ...(SEARCH_ALIASES[term] ?? [])];
}

/**
 * True when every term of the query appears in the haystack — in any order,
 * as a piece of a word, with or without the spaces between words.
 *
 * "yläpenkki kp" finds Vinopenkkipunnerrus käsipainoilla, "penkki punnerrus"
 * finds Penkkipunnerrus, and "trap bar" finds Trap bar -maastaveto — each
 * term is a piece of a word, so a space typed inside a word costs nothing.
 * The haystack's words are never joined: a term would then match across two
 * of them ("…bar in ta…" for "rinta").
 */
export function exerciseMatchesQuery(haystack: string, query: string): boolean {
  const hay = normalizeSearchText(haystack);
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  return terms.every((term) => termVariants(term).some((variant) => hay.includes(variant)));
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
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return 0;
  }
  const shown = normalizeSearchText(exerciseNameLabel(language, item.name));
  const stored = normalizeSearchText(item.name);
  // A muscle or body part the reader names by the start of its word ranks
  // with a name that starts so: "olkap" is asking for shoulder
  // work, and Pystypunnerrus sorted behind every lift with "olkapää" in its
  // name, past the list's cut (#bugs 2026-09-27). Popularity then decides.
  const facetWords = [item.bodyPart, ...(item.primaryMuscles ?? [])]
    .filter((facet): facet is string => Boolean(facet))
    .flatMap((facet) => [facet, libraryLabel(facet, language)])
    .flatMap((facet) => normalizeSearchText(facet).split(' '));
  const rankFor = (needle: string) => {
    if (shown === needle || stored === needle) {
      return 0;
    }
    // Three letters before a muscle counts: one or two would rank every lift
    // whose muscle starts so with the names the reader is spelling out.
    if (shown.startsWith(needle) || (needle.length >= 3 && facetWords.some((word) => word.startsWith(needle)))) {
      return 1;
    }
    if (shown.split(' ').some((word) => word.startsWith(needle))) {
      return 2;
    }
    if (shown.includes(needle) || stored.includes(needle)) {
      return 3;
    }
    return 4;
  };
  // "yläpenkki" ranks as what it stands for, so Vinopenkkipunnerrus leads —
  // and each word of a longer query stands for its own words ("yläpenkki kp").
  const best = Math.min(...queryVariants(normalized).map(rankFor));
  // Every word found in the name is a name match, whatever order they came in.
  return best === 4 && exerciseMatchesQuery(`${shown} ${stored}`, query) ? 3 : best;
}

/** The query with each word also read as what it stands for, every combination. */
function queryVariants(normalized: string): string[] {
  return normalized
    .split(' ')
    .filter(Boolean)
    .reduce<string[]>(
      (variants, term) => variants.flatMap((head) => termVariants(term).map((variant) => (head ? `${head} ${variant}` : variant))),
      [''],
    );
}

/**
 * The matches for a query, best answer first.
 *
 * Within a rank, a lift the app counts as popular comes before one it does
 * not — "penkki" is asking for the bench press, not the bench dip that
 * happens to be the shorter name — then a shorter name (the plainer version
 * of the same lift), then the caller's order.
 */
export function rankExerciseMatches<
  T extends Pick<ExerciseLibraryItem, 'name' | 'bodyPart' | 'category' | 'equipment' | 'primaryMuscles' | 'secondaryMuscles'>,
>(
  items: readonly T[],
  query: string,
  language: AppLanguage,
  /** A lower number is more popular; undefined is "not on the list". */
  popularity?: (item: T) => number | undefined,
): T[] {
  const needle = query.trim();
  if (!needle) {
    return [...items];
  }
  // A large finite stand-in: Infinity - Infinity is NaN, and a comparator
  // that returns NaN leaves the order to the engine.
  const popular = (item: T) => popularity?.(item) ?? Number.MAX_SAFE_INTEGER;
  const ranked = items
    .map((item, index) => {
      const label = exerciseNameLabel(language, item.name);
      return {
        item,
        index,
        rank: rankExerciseMatch(item, needle, language),
        popular: popular(item),
        label,
        // Past popularity, a lift whose name says what was typed comes before
        // one that only trains it: "hauis" is Hauiskääntö before Rannerulla.
        // Every word of the query, as itself or what it stands for.
        nameHit: exerciseMatchesQuery(`${label} ${item.name}`, needle) ? 0 : 1,
      };
    })
    .filter(({ item }) => exerciseMatchesQuery(buildExerciseSearchHaystack(item, language), needle))
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.popular - right.popular ||
        left.nameHit - right.nameHit ||
        left.label.length - right.label.length ||
        left.index - right.index,
    );
  return ranked.map(({ item }) => item);
}

/**
 * One row per name the reader sees, first kept: "Bench Press with Chains" and
 * "Chain Press" both read "Penkkipunnerrus ketjuilla", and the swap list showed
 * it twice (#bugs 2026-09-27). For choosing a replacement, not for browsing —
 * the library keeps both rows, each with its own pictures and steps.
 */
export function oneRowPerShownName<T extends Pick<ExerciseLibraryItem, 'name'>>(
  items: readonly T[],
  language: AppLanguage,
): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeSearchText(exerciseNameLabel(language, item.name));
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
