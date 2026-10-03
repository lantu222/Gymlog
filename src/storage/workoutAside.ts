/**
 * Put the stored workout bundle aside, for the crash screen's second action.
 *
 * A render error that comes from the workout bundle (the workout in progress,
 * the "last time" numbers beside it) remounts into the same error forever:
 * "Try again" re-reads the same bytes. This is the one deliberate way out, and
 * the reader asks for it (user 2026-10-03, after a repeated failure).
 *
 * It never deletes. The whole bundle is copied to its own key first — the same
 * pattern as the database's and the bundle's corrupt-copy slots — and the live
 * rows are removed only after that write has resolved. A copy that fails
 * throws and leaves the live data exactly as it was, so the caller can say so.
 * Nothing in the app reads the copy back; it stays on the phone. A second use
 * overwrites the first copy, as the corrupt slots do.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLargeItem, MissingPartsError, removeLargeItem, setLargeItem } from './largeItem';
import {
  LEGACY_WORKOUT_STORAGE_KEY,
  WORKOUT_ASIDE_STORAGE_KEY,
  WORKOUT_STORAGE_KEY,
} from './workoutKeys';

/** The stored bundle's text, or null when there is none. A damaged one reads as what is left of it. */
async function readStoredBundleText(): Promise<string | null> {
  try {
    return (await getLargeItem(WORKOUT_STORAGE_KEY)) ?? (await AsyncStorage.getItem(LEGACY_WORKOUT_STORAGE_KEY));
  } catch (error) {
    if (error instanceof MissingPartsError) {
      return error.readable;
    }
    throw error;
  }
}

/** Whether there is a stored workout bundle to put aside. False when it cannot be read. */
export async function hasStoredWorkoutBundle(): Promise<boolean> {
  try {
    return (await readStoredBundleText()) !== null;
  } catch {
    return false;
  }
}

/**
 * Copy the bundle to the aside key, then remove it from where the app reads it.
 * Resolves true when it was moved, false when there was nothing to move; rejects
 * when the copy could not be written or read, with the live data untouched.
 */
export async function setWorkoutBundleAside(): Promise<boolean> {
  const raw = await readStoredBundleText();
  if (raw === null) {
    return false;
  }
  await setLargeItem(WORKOUT_ASIDE_STORAGE_KEY, raw);
  // Only now: the copy has resolved.
  await removeLargeItem(WORKOUT_STORAGE_KEY);
  await AsyncStorage.removeItem(LEGACY_WORKOUT_STORAGE_KEY);
  return true;
}
