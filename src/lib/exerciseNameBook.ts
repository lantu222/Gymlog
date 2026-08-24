import type { ExerciseNameBookEntry } from '../types/models';

/**
 * The reader's own names for lifts, learned once and remembered.
 *
 * The library ships 873 English names. The reader writes *alatalja*, *viparit*,
 * *RDL KP*, *pecdec*, *takareiden makuulta* — and the importer's fuzzy match
 * does not get near any of them, because there is nothing to be fuzzy about:
 * "alatalja" and "Seated Cable Row" share no letters worth sharing. Guessing
 * harder cannot fix that. Being told once can.
 *
 * So when a name does not match, the reader says what they meant, and the app
 * writes it down FOR THEM. The second import of the same sheet is clean, and
 * the same book answers when they type a lift name into an empty workout.
 *
 * This is deliberately not `GUIDED_LIBRARY_ALIASES`, which is a fixed table
 * shipped in `src/lib`. That table is the app's opinion about English spelling
 * variants; this one is a person's own vocabulary, so it belongs to their
 * database and travels with their backup.
 *
 * Everything here is pure: the store is passed in and a new store comes back.
 */

/**
 * The lookup key.
 *
 * Case, punctuation and spacing all vary between the same reader's own
 * entries — "RDL KP", "rdl kp", "RDL-KP" are one name — so the key is the
 * squashed form. Kept identical in spirit to the importer's `normalizeName`,
 * but it must keep non-ASCII letters: stripping them would turn "vipunostot"
 * and "vipunostöt" into the same key by accident and, worse, reduce a name
 * written entirely in Cyrillic or Greek to nothing at all.
 */
export function normalizeAlias(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The entry the reader's spelling resolves to, or null if unlearned. */
export function lookupNameBook(
  book: readonly ExerciseNameBookEntry[],
  rawName: string,
): ExerciseNameBookEntry | null {
  const alias = normalizeAlias(rawName);
  if (!alias) {
    return null;
  }
  return book.find((entry) => entry.alias === alias) ?? null;
}

/**
 * Teach the book one name.
 *
 * Re-teaching the same spelling replaces the old answer rather than adding a
 * second one — a reader correcting a mistake means the new answer, and two
 * entries for one key would make the lookup depend on insertion order. The
 * corrected entry moves to the front, so the most recently taught names are
 * the cheapest to find and the easiest to show back.
 */
export function rememberName(
  book: readonly ExerciseNameBookEntry[],
  rawName: string,
  exercise: { name: string; libraryItemId: string | null },
  now: Date = new Date(),
): ExerciseNameBookEntry[] {
  const alias = normalizeAlias(rawName);
  if (!alias || !exercise.name.trim()) {
    return [...book];
  }
  const entry: ExerciseNameBookEntry = {
    alias,
    // The reader's own spelling, kept as they wrote it: the normalised key is
    // for matching, and a settings screen listing squashed keys would be
    // showing them something they never typed.
    wrote: rawName.trim(),
    exerciseName: exercise.name.trim(),
    libraryItemId: exercise.libraryItemId,
    learnedAt: now.toISOString(),
  };
  return [entry, ...book.filter((existing) => existing.alias !== alias)];
}

/**
 * How many rows a book would rescue from a set of names.
 *
 * Used to tell the reader what the book is doing for them ("12 of your own
 * names recognised") rather than leaving it as invisible machinery. Counts
 * distinct spellings, not occurrences: a name used on six days was taught
 * once.
 */
export function countKnownNames(
  book: readonly ExerciseNameBookEntry[],
  rawNames: readonly string[],
): number {
  const known = new Set<string>();
  for (const raw of rawNames) {
    const alias = normalizeAlias(raw);
    if (alias && book.some((entry) => entry.alias === alias)) {
      known.add(alias);
    }
  }
  return known.size;
}
