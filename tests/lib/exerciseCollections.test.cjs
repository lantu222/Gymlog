const assert = require('node:assert/strict');

const {
  getExerciseCollections,
  getExerciseCollection,
  resolveCollectionProgress,
  findCollectionInProgress,
  EXERCISE_COLLECTION_TABLES,
} = require('../../.test-dist/lib/exerciseCollections.js');
const { createSeedExerciseLibrary } = require('../../.test-dist/data/seed.js');

/**
 * A collection names other exercises, which is the shape that has produced
 * invented lifts in this repo twice: once in the programme composer, once in
 * the teaching swaps I wrote yesterday. Same sweep, third time.
 *
 * The design's list needed two corrections before it could ship: it named
 * "Overhead Press" and "Barbell Row", which the CATALOG uses and the library
 * does not. A programme's exercise list gets away with those because the name
 * matcher resolves them; a collection row opens a page directly and cannot.
 */

// The set a row can actually open — the seed library minus the legacy `lib_*`
// rows, which App.tsx filters out of the browser.
const reachable = new Set(
  createSeedExerciseLibrary()
    .filter((item) => !item.id.startsWith('lib_'))
    .map((item) => item.name),
);

function everyEntry() {
  return Object.entries(EXERCISE_COLLECTION_TABLES).flatMap(([language, collections]) =>
    collections.flatMap((collection) =>
      collection.entries.map((entry) => ({ language, collection, entry })),
    ),
  );
}

module.exports = [
  {
    name: 'collections: every entry names a lift the reader can actually open',
    run() {
      const invented = everyEntry()
        .filter(({ entry }) => !reachable.has(entry.exerciseName))
        .map(({ language, collection, entry }) => `${language}:${collection.id} → ${entry.exerciseName}`);
      assert.deepEqual(invented, [], `collection entries that are not library lifts: ${invented.join(', ')}`);
    },
  },
  {
    /**
     * A course with no lifts in it is not a course, and it is also a division
     * by zero: the progress bars take a percentage, and `width: 'NaN%'` is a
     * style React Native cannot lay out. `resolveCollectionProgress` returns 0
     * for the empty case as well — belt and braces, because this one would
     * reach the screen looking like a rendering bug rather than a data one.
     */
    name: 'collections: a course has lifts in it, and its percentage is a number',
    run() {
      for (const [language, collections] of Object.entries(EXERCISE_COLLECTION_TABLES)) {
        for (const collection of collections) {
          assert.ok(
            collection.entries.length > 0,
            `${language}:${collection.id} is a title with no lessons in it`,
          );
        }
      }

      const empty = { id: 'empty', title: '', blurb: '', intro: '', entries: [], cover: ['#000', '#111'] };
      const progress = resolveCollectionProgress(empty, () => false);
      assert.equal(progress.percent, 0);
      assert.ok(Number.isFinite(progress.percent));

      const half = resolveCollectionProgress(
        getExerciseCollection('six_lifts', 'en'),
        (name) => name === 'Barbell Squat' || name === 'Barbell Deadlift' || name === "Farmer's Walk",
      );
      assert.equal(half.percent, 50);
    },
  },
  {
    name: 'collections: no lift appears twice in one course',
    run() {
      for (const [language, collections] of Object.entries(EXERCISE_COLLECTION_TABLES)) {
        for (const collection of collections) {
          const names = collection.entries.map((entry) => entry.exerciseName);
          assert.equal(
            new Set(names).size,
            names.length,
            `${language}:${collection.id} lists the same lift twice`,
          );
        }
      }
    },
  },
  {
    /**
     * Both languages teach the same lifts in the same order. Only the words
     * differ — a course that reordered itself per language would be two
     * different recommendations wearing one name.
     */
    name: 'collections: the two languages are one course, differently worded',
    run() {
      const en = EXERCISE_COLLECTION_TABLES.en;
      const fi = EXERCISE_COLLECTION_TABLES.fi;
      assert.deepEqual(fi.map((c) => c.id), en.map((c) => c.id));

      for (let index = 0; index < en.length; index += 1) {
        assert.deepEqual(
          fi[index].entries.map((entry) => entry.exerciseName),
          en[index].entries.map((entry) => entry.exerciseName),
          `${en[index].id}: the order or the lifts differ between languages`,
        );
        // The words DO differ, or the Finnish reader is reading English.
        assert.notEqual(fi[index].title, en[index].title);
        assert.notEqual(fi[index].intro, en[index].intro);
        fi[index].entries.forEach((entry, i) => {
          assert.notEqual(entry.pattern, en[index].entries[i].pattern, `${entry.exerciseName}: pattern untranslated`);
        });
      }
    },
  },
  {
    name: 'collections: progress counts the learned and points at the first that is not',
    run() {
      const collection = getExerciseCollection('six_lifts', 'en');
      assert.ok(collection);

      const none = resolveCollectionProgress(collection, () => false);
      assert.equal(none.done, 0);
      assert.equal(none.total, 6);
      assert.equal(none.nextExerciseName, 'Barbell Squat');

      // Learning out of order does not move NEXT past what is still missing:
      // the order is a recommendation, so the next one is the first gap.
      const skipped = resolveCollectionProgress(collection, (name) => name === 'Barbell Deadlift');
      assert.equal(skipped.done, 1);
      assert.equal(skipped.nextExerciseName, 'Barbell Squat');

      const all = resolveCollectionProgress(collection, () => true);
      assert.equal(all.done, 6);
      assert.equal(all.nextExerciseName, null, 'a finished course has nothing next');
    },
  },
  {
    /**
     * The library only offers a way back into a course that was actually
     * begun. Pointing at one the reader has never opened would be an
     * advertisement wearing the words "pick up where you left off".
     */
    name: 'collections: only a started, unfinished course is picked up',
    run() {
      const collections = getExerciseCollections('en');

      assert.equal(findCollectionInProgress(collections, () => false), null, 'nothing started');
      assert.equal(findCollectionInProgress(collections, () => true), null, 'nothing left');

      const started = findCollectionInProgress(collections, (name) => name === 'Barbell Squat');
      assert.ok(started);
      assert.equal(started.collection.id, 'six_lifts');
      assert.equal(started.progress.done, 1);
      assert.equal(started.progress.nextExerciseName, 'Barbell Deadlift');
    },
  },
  {
    name: 'collections: an unknown id is null rather than a blank screen',
    run() {
      assert.equal(getExerciseCollection('no_such_course', 'en'), null);
      assert.equal(getExerciseCollection('', 'fi'), null);
      assert.ok(getExerciseCollection('six_lifts', 'fi'));
    },
  },
];
