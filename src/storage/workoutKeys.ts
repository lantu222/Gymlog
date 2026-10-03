/**
 * The workout bundle's storage keys, in a module of their own so the crash
 * screen can reach them without importing the whole workout feature.
 */
export const WORKOUT_STORAGE_KEY = '@vinha/workout/v1';
/** Pre-rename key; see the note in storage/database.ts. */
export const LEGACY_WORKOUT_STORAGE_KEY = '@gymlog/workout/v1';
/** Where an unreadable bundle is put before an empty one replaces it. */
export const WORKOUT_CORRUPT_STORAGE_KEY = '@vinha/workout/corrupt';
/**
 * Where the crash screen puts the bundle when the reader asks for the workout
 * in progress to be set aside (2026-10-03). Nothing reads it back: it is kept,
 * not restored — see storage/workoutAside.
 */
export const WORKOUT_ASIDE_STORAGE_KEY = '@vinha/workout/aside';
