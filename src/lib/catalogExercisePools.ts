import { GENERATED_EXERCISE_LIBRARY } from '../data/generatedExerciseLibrary';
import { findGuidedLibraryIndex } from './guidedPlayer';
import { SetupFocusArea } from '../types/models';

/**
 * Exercise names the plan composer is allowed to invent.
 *
 * Three places used to write exercise names by hand — focus emphasis, the
 * equipment fallback chain, and the supplemental days that pad a template out
 * to the user's chosen day count. Each carried a comment saying the names were
 * grounded in the catalog. None of them were: the composer was producing
 * "Arms", "Lat Pulldown" and "Glute Bridge", none of which exist in the 873
 * exercise library, so the day arrived with no photo, no demo, no instructions
 * and nothing for the swap feature to match.
 *
 * Everything here is checked against the library by a test. A name that is not
 * in the catalog cannot reach a user's plan.
 */

const byName = new Map(
  GENERATED_EXERCISE_LIBRARY.map((entry) => [entry.name.trim().toLowerCase(), entry] as const),
);

const libraryNames = GENERATED_EXERCISE_LIBRARY.map((entry) => entry.name);

export function isCatalogExercise(name: string) {
  return byName.has(name.trim().toLowerCase());
}

export function getCatalogBodyPart(name: string) {
  return byName.get(name.trim().toLowerCase())?.bodyPart ?? null;
}

/**
 * Body part for a name that may not be spelled the way the library spells it.
 *
 * The ready templates say "Bench Press" where the library says "Barbell Bench
 * Press - Medium Grip", so an exact lookup reports nothing for most of the
 * catalog. Reuses the guided player's matcher rather than repeating its alias
 * table — two copies of that mapping would drift, and then a day could show a
 * photo of one muscle group while emphasis treated it as another.
 */
export function resolveCatalogBodyPart(name: string) {
  const exact = getCatalogBodyPart(name);
  if (exact !== null) {
    return exact;
  }

  const index = findGuidedLibraryIndex(name, libraryNames);
  return index === null ? null : GENERATED_EXERCISE_LIBRARY[index].bodyPart;
}

/**
 * Whether the logger should ask for a weight. Reading the catalog's own
 * equipment beats guessing from the name: "Butt Lift (Bridge)" matches no
 * bodyweight keyword but is bodyweight, and asking a bodyweight-only user for
 * kilograms is the specific failure this replaces.
 */
export function getCatalogTrackingMode(name: string): 'bodyweight' | 'load_and_reps' {
  return byName.get(name.trim().toLowerCase())?.equipment === 'bodyweight'
    ? 'bodyweight'
    : 'load_and_reps';
}

/** Bodyweight-first, then the loaded version. Both are real catalog entries. */
export interface FocusAccessoryPool {
  bodyweight: string[];
  loaded: string[];
}

export const FOCUS_ACCESSORY_POOL: Record<SetupFocusArea, FocusAccessoryPool> = {
  chest: {
    bodyweight: ['Push-Up Wide', 'Incline Push-Up'],
    loaded: ['Incline Dumbbell Press', 'Dumbbell Flyes'],
  },
  back: {
    bodyweight: ['Inverted Row', 'Bodyweight Mid Row'],
    loaded: ['Close-Grip Front Lat Pulldown', 'Bent Over Two-Dumbbell Row'],
  },
  shoulders: {
    // "Alternating Deltoid Raise" is a dumbbell lift whose name never says so,
    // which means the gear filter cannot see what it needs. Keep names the
    // equipment rules can read.
    bodyweight: ['Band Pull Apart', 'Arm Circles'],
    loaded: ['Arnold Dumbbell Press', 'Cable Rear Delt Fly'],
  },
  arms: {
    bodyweight: ['Bench Dips', 'Body-Up'],
    loaded: ['Alternate Hammer Curl', 'Triceps Pushdown'],
  },
  core: {
    bodyweight: ['Plank', 'Dead Bug'],
    loaded: ['Cable Crunch', 'Hanging Leg Raise'],
  },
  quads: {
    bodyweight: ['Bodyweight Squat', 'Bodyweight Walking Lunge'],
    loaded: ['Leg Press', 'Dumbbell Lunges'],
  },
  glutes: {
    bodyweight: ['Butt Lift (Bridge)', 'Glute Kickback'],
    loaded: ['Barbell Hip Thrust', 'One-Legged Cable Kickback'],
  },
  hamstrings: {
    bodyweight: ['Floor Glute-Ham Raise', 'Band Good Morning'],
    loaded: ['Romanian Deadlift', 'Glute Ham Raise'],
  },
  calves: {
    bodyweight: ['Donkey Calf Raises', 'Calf Raises - With Bands'],
    loaded: ['Seated Calf Raise', 'Calf Press'],
  },
  legs: {
    bodyweight: ['Bodyweight Squat', 'Bodyweight Walking Lunge'],
    loaded: ['Leg Press', 'Dumbbell Lunges'],
  },
  mobility: {
    bodyweight: ['Cat Stretch', 'All Fours Quad Stretch'],
    loaded: ['Cat Stretch', 'All Fours Quad Stretch'],
  },
  conditioning: {
    // Not "Air Bike" — in this catalog that is the ab exercise, not a fan bike.
    bodyweight: ['Mountain Climbers', 'Battling Ropes'],
    loaded: ['Elliptical Trainer', 'Jogging, Treadmill'],
  },
  bodyweight: {
    bodyweight: ['Push-Up Wide', 'Plank'],
    loaded: ['Push-Up Wide', 'Plank'],
  },
};

/**
 * Which catalog body parts a focus area is about. Used to land an accessory on
 * a day that already trains it — a glute accessory belongs on leg day, not on
 * the upper-body day the round-robin happened to reach.
 */
export const FOCUS_AREA_BODY_PARTS: Record<SetupFocusArea, string[]> = {
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps'],
  core: ['core'],
  quads: ['legs'],
  glutes: ['glutes', 'legs'],
  hamstrings: ['legs', 'glutes'],
  calves: ['legs'],
  legs: ['legs', 'glutes'],
  mobility: [],
  conditioning: [],
  bodyweight: [],
};

/**
 * How much of a session already trains this area. Zero means no signal, not a
 * ban — mobility and conditioning match nothing and may go anywhere.
 */
export function sessionFocusAffinity(exerciseNames: string[], area: SetupFocusArea) {
  const parts = FOCUS_AREA_BODY_PARTS[area] ?? [];
  if (parts.length === 0) {
    return 0;
  }
  return exerciseNames.filter((name) => {
    const bodyPart = resolveCatalogBodyPart(name);
    return bodyPart !== null && parts.includes(bodyPart);
  }).length;
}

/**
 * Exercises for the optional days that pad a template out to the requested day
 * count. Short on purpose — these days are 25–30 minute add-ons.
 */
export const SUPPLEMENTAL_DAY_POOL = {
  accessoryStrength: {
    bodyweight: ['Bench Dips', 'Inverted Row', 'Plank'],
    loaded: ['Alternate Hammer Curl', 'Triceps Pushdown', 'Cable Crunch'],
  },
  recoveryStrength: {
    bodyweight: ['Cat Stretch', "Farmer's Walk"],
    loaded: ['Cat Stretch', "Farmer's Walk"],
  },
  easyRun: {
    bodyweight: ['Trail Running/Walking', 'Ankle Circles'],
    loaded: ['Jogging, Treadmill', 'Ankle Circles'],
  },
  longRun: {
    bodyweight: ['Trail Running/Walking', 'All Fours Quad Stretch'],
    loaded: ['Trail Running/Walking', 'All Fours Quad Stretch'],
  },
  bodyweightVolume: {
    bodyweight: ['Push-Up Wide', 'Bodyweight Walking Lunge', 'Plank'],
    loaded: ['Push-Up Wide', 'Bodyweight Walking Lunge', 'Plank'],
  },
  conditioningMobility: {
    bodyweight: ['Mountain Climbers', 'Cat Stretch'],
    loaded: ['Elliptical Trainer', 'Cat Stretch'],
  },
  recoveryMobility: {
    bodyweight: ['Cat Stretch', 'Plank'],
    loaded: ['Cat Stretch', 'Plank'],
  },
  easyConditioning: {
    bodyweight: ['Trail Running/Walking', 'Chin To Chest Stretch'],
    loaded: ['Recumbent Bike', 'Chin To Chest Stretch'],
  },
} satisfies Record<string, FocusAccessoryPool>;

export type SupplementalDayKind = keyof typeof SUPPLEMENTAL_DAY_POOL;

/**
 * `null` available equipment means the setup is unconstrained, so the loaded
 * version is fine. An empty list means the user told us they have nothing.
 */
export function pickPoolVariant(pool: FocusAccessoryPool, available: string[] | null) {
  return available !== null && available.length === 0 ? pool.bodyweight : pool.loaded;
}
