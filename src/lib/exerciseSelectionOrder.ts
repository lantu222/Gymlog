/**
 * The order a multi-select picker hands its exercises back in.
 *
 * Both pickers kept the taps in order — `[...current, id]` — and then threw
 * that order away at the confirm step by filtering the LIBRARY array:
 *
 *     items.filter((item) => selectedIds.includes(item.id))
 *
 * `Array.prototype.filter` walks the array it is called on, so the result came
 * out in library order, which is the order `generatedExerciseLibrary.ts`
 * happens to hold. Tapping the cable crunch and then the side bend added the
 * side bend first, because that is where it sits in the file ("valitsin
 * vatsarutistuksen eka silti kyljet tuli ensimmäiseksi", #bugs 2026-08-28).
 *
 * The order is not cosmetic: it is the order the sets will be logged in, and
 * in the freestyle logger there is nothing else that decides it — the reader
 * has no way to reorder afterwards.
 *
 * Ids with no matching item are dropped rather than left as holes. A stale id
 * means the library changed under an open sheet, and half an exercise is worse
 * than none.
 */
import { ExerciseLibraryItem } from '../types/models';

export function orderExercisesBySelection<T extends Pick<ExerciseLibraryItem, 'id'>>(
  items: readonly T[],
  selectedIds: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];

  for (const id of selectedIds) {
    // A double tap that survived into the list must not add the lift twice.
    if (seen.has(id)) {
      continue;
    }
    const item = byId.get(id);
    if (item) {
      seen.add(id);
      ordered.push(item);
    }
  }

  return ordered;
}
