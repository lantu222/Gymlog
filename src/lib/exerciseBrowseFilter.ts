/**
 * What the exercise picker offers before the reader has said what they want.
 *
 * The library is 873 entries wide because it was imported whole, and about
 * sixty of them are not things you log a set of: hamstring stretches, cone
 * drills, and the "(single response)" / "(multiple response)" plyometric test
 * protocols. Filtering by chest handed back "Behind Head Chest Stretch" and
 * "Chest Push from 3 point stance" alongside the bench press, and the reader
 * had to read past them to build a day ("vaikka filtteröin rinta niin ihan
 * ihme liikkeitä tulee esiin", #bugs 2026-08-26).
 *
 * They are hidden rather than deleted. A stretch is still a real thing someone
 * might want to find, and deleting the row would orphan any programme or log
 * that already points at it — so it stays in the library, stays resolvable by
 * name, and comes back the moment the reader types a query. The rule is about
 * what is *offered*, not what exists.
 */
import { ExerciseLibraryItem } from '../types/models';

type BrowsableExercise = Pick<ExerciseLibraryItem, 'name'>;

/**
 * Deliberately narrow. Each pattern names a family that is measured in held
 * seconds, ground covered or reps-against-a-clock rather than in sets — never
 * a family that merely sounds unusual.
 *
 * `\bdrag\b` is absent on purpose: the drag curl is a barbell biceps lift, and
 * a rule that catches it to also catch sled drags costs more than it saves.
 * Sled and Bosu work stays for the same reason — people load and log both.
 */
const NOT_A_LOGGED_SET: RegExp[] = [
  // Mobility. Held, not repped.
  /\bstretch(?:es|ing)?\b/i,
  // Lab protocols from the source data's plyometric section.
  /\((?:multiple|single) response\)/i,
  // Field drills: the equipment is a cone, and the unit is a run.
  /\bcone\b/i,
  /\bhurdle hops\b/i,
  /\bsprint\b/i,
];

/** True when the exercise belongs in the picker's default listing. */
export function isBrowsableExercise(item: BrowsableExercise): boolean {
  return !NOT_A_LOGGED_SET.some((pattern) => pattern.test(item.name));
}

/**
 * The picker's list.
 *
 * With a query the reader has named what they are after, so nothing is
 * withheld — searching "stretch" or "venytys" finds the stretches. With no
 * query the app is the one choosing, and it chooses the things you can log.
 */
export function filterBrowsableExercises<T extends BrowsableExercise>(
  items: T[],
  options?: { query?: string },
): T[] {
  if (options?.query?.trim()) {
    return items;
  }

  return items.filter(isBrowsableExercise);
}
