const assert = require('node:assert/strict');

const { createFakeAsyncStorage, loadAgainstFake } = require('./fakeAsyncStorage.cjs');
const { STORAGE_CHUNK_CHARS } = require('../../.test-dist/lib/storageChunks');

/**
 * Putting the workout bundle aside from the crash screen (2026-10-03).
 *
 * The rule under test: the live bundle is removed only after its copy has
 * resolved, and a copy that fails leaves the live data exactly as it was.
 */

const LIVE = '@vinha/workout/v1';
const LEGACY = '@gymlog/workout/v1';
const ASIDE = '@vinha/workout/aside';

function load() {
  const fake = createFakeAsyncStorage();
  // One require pass, so the module under test and `large` share a largeItem.
  const { aside, large } = loadAgainstFake(fake, (requireDist) => ({
    aside: requireDist('storage/workoutAside.js'),
    large: requireDist('storage/largeItem.js'),
  }));
  return { fake, ...aside, large };
}

const bundle = JSON.stringify({ activeSession: { id: 's1' }, history: { sessions: [], slotHistory: {} } });

module.exports = [
  {
    name: 'workout aside: the bundle is copied under its own key, then the live key goes; nothing else is touched',
    async run() {
      const { fake, setWorkoutBundleAside, hasStoredWorkoutBundle } = load();
      fake.rows.set(LIVE, bundle);
      fake.rows.set('@vinha/database/v1', '{"db":true}');

      assert.equal(await hasStoredWorkoutBundle(), true);
      assert.equal(await setWorkoutBundleAside(), true);

      assert.equal(fake.rows.get(ASIDE), bundle, 'the copy is byte for byte');
      assert.equal(fake.rows.has(LIVE), false);
      assert.equal(fake.rows.get('@vinha/database/v1'), '{"db":true}', 'the database is not the workout');
      assert.equal(await hasStoredWorkoutBundle(), false);
    },
  },
  {
    name: 'workout aside: a copy that fails keeps the live bundle, rejects, and removes nothing',
    async run() {
      const { fake, setWorkoutBundleAside } = load();
      fake.rows.set(LIVE, bundle);
      const order = [];
      const setItem = fake.setItem;
      const removeItem = fake.removeItem;
      fake.setItem = async (key, value) => {
        order.push(`set ${key}`);
        if (key === ASIDE) {
          throw new Error('database or disk is full');
        }
        return setItem(key, value);
      };
      fake.removeItem = async (key) => {
        order.push(`remove ${key}`);
        return removeItem(key);
      };

      await assert.rejects(setWorkoutBundleAside(), /disk is full/);

      assert.equal(fake.rows.get(LIVE), bundle, 'the live bundle moved though the copy failed');
      assert.equal(fake.rows.has(ASIDE), false);
      assert.deepEqual(order.filter((step) => step.startsWith('remove')), [], 'something was removed after a failed copy');
    },
  },
  {
    name: 'workout aside: the live key is removed only after the copy resolved (a slow copy still sees the live rows)',
    async run() {
      const { fake, setWorkoutBundleAside } = load();
      fake.rows.set(LIVE, bundle);
      const setItem = fake.setItem;
      let liveWhileCopying = null;
      fake.setItem = async (key, value) => {
        if (key === ASIDE) {
          await new Promise((resolve) => setTimeout(resolve, 5));
          liveWhileCopying = fake.rows.get(LIVE);
        }
        return setItem(key, value);
      };
      await setWorkoutBundleAside();
      assert.equal(liveWhileCopying, bundle);
      assert.equal(fake.rows.has(LIVE), false);
    },
  },
  {
    name: 'workout aside: a long bundle in parts is copied whole and every live part goes',
    async run() {
      const { fake, large, setWorkoutBundleAside } = load();
      const big = JSON.stringify({ body: '€'.repeat(STORAGE_CHUNK_CHARS * 3) });
      await large.setLargeItem(LIVE, big);
      assert.ok([...fake.rows.keys()].some((key) => key.startsWith(`${LIVE}#`)), 'the fixture was not split');

      assert.equal(await setWorkoutBundleAside(), true);

      assert.equal(await large.getLargeItem(ASIDE), big);
      assert.deepEqual([...fake.rows.keys()].filter((key) => key.startsWith(`${LIVE}`)), []);
    },
  },
  {
    name: 'workout aside: a bundle only under the pre-rename key is moved too, and no bundle is a no-op',
    async run() {
      const { fake, setWorkoutBundleAside, hasStoredWorkoutBundle } = load();
      assert.equal(await hasStoredWorkoutBundle(), false, 'nothing stored: the screen hides the action');
      assert.equal(await setWorkoutBundleAside(), false);
      assert.equal(fake.rows.size, 0, 'no copy of nothing');

      fake.rows.set(LEGACY, bundle);
      assert.equal(await setWorkoutBundleAside(), true);
      assert.equal(fake.rows.get(ASIDE), bundle);
      assert.equal(fake.rows.has(LEGACY), false, 'left behind, it would load again as the live bundle');
    },
  },
  {
    name: 'workout aside: a damaged split bundle is kept as the readable remains, never dropped',
    async run() {
      const { fake, setWorkoutBundleAside } = load();
      fake.rows.set(LIVE, 'vinha-chunks:3:700000');
      fake.rows.set(`${LIVE}#0`, '{"a":"part zero"}');

      assert.equal(await setWorkoutBundleAside(), true);
      assert.ok(fake.rows.get(ASIDE).includes('part zero'), 'the part that was there is not in the copy');
      assert.equal(fake.rows.has(LIVE), false);
    },
  },
];
