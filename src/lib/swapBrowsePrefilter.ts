/**
 * Which chip the swap sheet's "browse all exercises" opens on.
 *
 * "Tähän voisi tulla se sama valikko kuin liikekirjasto on mutta pidetään
 * filtteröinti siihen liikkeeseen perustuva eli lähin sitä mitä haluu tehdä"
 * (#bugs 2026-09-29): browsing from a swap should not start at "kaikki
 * liikkeet" — it should start narrowed to what the reader is standing at.
 *
 * The signal is the same one `buildSwapOptionsForSlot`'s "Ehdotetut" list
 * already answers with — the exercise's own body part — read here from the
 * library row rather than the substitution group, so the chip preselects
 * even for a slot whose group is thin or missing. Legs get the same three-way
 * split the library's own chips use (LEG_MUSCLE_FILTERS), so a hamstring
 * exercise opens on "Takareidet", not the whole 276-row "Jalat" bucket.
 */
import { BodyPartFilter, LEG_MUSCLE_FILTERS } from './exerciseBrowseFilter';
import { displayEquipmentValue } from './libraryLabel';
import { ExerciseLibraryItem } from '../types/models';

type SwapBrowseSource = Pick<ExerciseLibraryItem, 'bodyPart' | 'primaryMuscles'>;

export function resolveSwapBrowsePrefilter(current: SwapBrowseSource | null | undefined): BodyPartFilter {
  if (!current || !current.bodyPart) {
    return 'all';
  }
  const primary = current.primaryMuscles?.[0];
  if (current.bodyPart === 'legs' && primary && (LEG_MUSCLE_FILTERS as readonly string[]).includes(primary)) {
    return primary as BodyPartFilter;
  }
  return current.bodyPart;
}

type SwapCandidate = Pick<ExerciseLibraryItem, 'id' | 'category' | 'equipment' | 'sourceEquipment'>;

/**
 * The swap sheet's unsearched list, nearest first.
 *
 * Inside the lift's own body part the list was ordered by popularity alone,
 * so a bench press swap opened on a kettlebell floor press above the incline
 * bench — "lähin sitä mitä haluu tehdä" (#bugs 2026-09-29) read as the most
 * popular chest lift, not the closest one (device, 2026-09-30). Nearest is
 * the same kit first (the rack is taken, the bar is not), then the same kind
 * of lift; popularity breaks the ties, and the sort is stable past that.
 *
 * Without the current lift's library row there is nothing to be near, and
 * the order is popularity alone — what the list did before.
 */
export function orderSwapCandidates<T extends SwapCandidate>(
  pool: readonly T[],
  current: SwapCandidate | null | undefined,
  popularOrder: ReadonlyMap<string, number>,
): T[] {
  const equipment = current ? displayEquipmentValue(current) : null;
  const nearness = (item: T) =>
    current
      ? (displayEquipmentValue(item) === equipment ? 2 : 0) + (item.category === current.category ? 1 : 0)
      : 0;
  return [...pool].sort(
    (left, right) =>
      nearness(right) - nearness(left) ||
      (popularOrder.get(left.id) ?? 1e6) - (popularOrder.get(right.id) ?? 1e6),
  );
}
