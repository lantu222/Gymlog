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
