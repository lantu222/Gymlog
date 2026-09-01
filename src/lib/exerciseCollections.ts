import { AppLanguage } from '../types/models';

/**
 * Short courses: a handful of lifts, in the order they are easiest to learn.
 *
 * A collection is an ORDER, not a filter — that is the whole reason to have
 * one. The library can already show you every squat; what it cannot tell you
 * is which lift to learn before which, and that is the only thing this adds.
 *
 * NOTHING IS LOCKED. Teaching that withholds the next lesson until you tick
 * the last one is a game, not a library. The order is a recommendation and
 * every row opens, learned or not.
 *
 * ONE COURSE, for now. The index says why: a course with no written lessons in
 * it is just a title, and the teaching layer covers three lifts today (user
 * decision 2026-08-31 — write for the ones people meet first, then grow). A
 * second collection ships when its lessons do, not before.
 */

export interface ExerciseCollectionEntry {
  /**
   * The movement pattern this lift stands for. The reason it is in the list —
   * "Barbell Squat" is the example; "Squat" is the lesson.
   */
  pattern: string;
  /** The library name, so the row opens that lift's own screen. */
  exerciseName: string;
}

export interface ExerciseCollection {
  id: string;
  title: string;
  /** One line, saying what the course is for rather than how long it is. */
  blurb: string;
  /** The longer why, on the collection's own screen. */
  intro: string;
  entries: ExerciseCollectionEntry[];
  /** Two hex stops for the cover wash. */
  cover: [string, string];
}

const SIX_LIFTS_EN: ExerciseCollection = {
  id: 'six_lifts',
  title: 'The six lifts',
  blurb: 'Squat, hinge, press, pull, carry, brace',
  intro:
    'Six patterns, in the order they are easiest to learn. Every programme in the catalog is built out of these — learn them once and the rest of the library stops being a list of strangers.',
  cover: ['#7699FB', '#2D48C0'],
  entries: [
    { pattern: 'Squat', exerciseName: 'Barbell Squat' },
    { pattern: 'Hinge', exerciseName: 'Barbell Deadlift' },
    { pattern: 'Horizontal press', exerciseName: 'Barbell Bench Press - Medium Grip' },
    // The library's own names, not the catalog's shorthand: a row here opens a
    // page directly, so it cannot lean on the name matcher the way a
    // programme's exercise list does.
    { pattern: 'Vertical press', exerciseName: 'Standing Military Press' },
    { pattern: 'Horizontal pull', exerciseName: 'Bent Over Barbell Row' },
    { pattern: 'Carry & brace', exerciseName: "Farmer's Walk" },
  ],
};

const SIX_LIFTS_FI: ExerciseCollection = {
  ...SIX_LIFTS_EN,
  title: 'Kuusi liikettä',
  blurb: 'Kyykky, sarana, punnerrus, veto, kanto, tuenta',
  intro:
    'Kuusi liikemallia siinä järjestyksessä kuin ne on helpointa oppia. Jokainen katalogin ohjelma on rakennettu näistä — opettele ne kerran, eikä loppu kirjastosta ole enää pelkkä lista tuntemattomia.',
  entries: [
    { pattern: 'Kyykky', exerciseName: 'Barbell Squat' },
    { pattern: 'Sarana', exerciseName: 'Barbell Deadlift' },
    { pattern: 'Vaakapunnerrus', exerciseName: 'Barbell Bench Press - Medium Grip' },
    { pattern: 'Pystypunnerrus', exerciseName: 'Standing Military Press' },
    { pattern: 'Vaakaveto', exerciseName: 'Bent Over Barbell Row' },
    { pattern: 'Kanto ja tuenta', exerciseName: "Farmer's Walk" },
  ],
};

const COLLECTIONS_EN: ExerciseCollection[] = [SIX_LIFTS_EN];
const COLLECTIONS_FI: ExerciseCollection[] = [SIX_LIFTS_FI];

export function getExerciseCollections(language: AppLanguage = 'en'): ExerciseCollection[] {
  return language === 'fi' ? COLLECTIONS_FI : COLLECTIONS_EN;
}

export function getExerciseCollection(
  id: string,
  language: AppLanguage = 'en',
): ExerciseCollection | null {
  return getExerciseCollections(language).find((collection) => collection.id === id) ?? null;
}

export interface CollectionProgress {
  done: number;
  total: number;
  /** The first entry not yet learned — what the screen marks NEXT. */
  nextExerciseName: string | null;
}

/**
 * How far through a collection this reader is.
 *
 * Learned is stored by library item id and a collection lists library names,
 * so the caller resolves names to ids and passes the set. Doing the lookup
 * here would drag the library into a pure module for no gain.
 */
export function resolveCollectionProgress(
  collection: ExerciseCollection,
  isLearned: (exerciseName: string) => boolean,
): CollectionProgress {
  let done = 0;
  let nextExerciseName: string | null = null;

  for (const entry of collection.entries) {
    if (isLearned(entry.exerciseName)) {
      done += 1;
    } else if (nextExerciseName === null) {
      nextExerciseName = entry.exerciseName;
    }
  }

  return { done, total: collection.entries.length, nextExerciseName };
}

/**
 * The one to offer a way back into, from the library.
 *
 * Started but not finished beats untouched: a course you have begun is the one
 * you meant to come back to. With nothing started there is nothing to pick up,
 * and the card does not appear rather than pointing at a course the reader has
 * never opened.
 */
export function findCollectionInProgress(
  collections: ExerciseCollection[],
  isLearned: (exerciseName: string) => boolean,
): { collection: ExerciseCollection; progress: CollectionProgress } | null {
  for (const collection of collections) {
    const progress = resolveCollectionProgress(collection, isLearned);
    if (progress.done > 0 && progress.done < progress.total) {
      return { collection, progress };
    }
  }
  return null;
}

/** Exported for the sweep that keeps every entry pointing at a real lift. */
export const EXERCISE_COLLECTION_TABLES = { en: COLLECTIONS_EN, fi: COLLECTIONS_FI };
