const assert = require('node:assert/strict');

const { createFakeAsyncStorage, loadAgainstFake, CURSOR_WINDOW_BYTES } = require('./fakeAsyncStorage.cjs');
const { STORAGE_CHUNK_CHARS } = require('../../.test-dist/lib/storageChunks');

/**
 * The splitting reader and writer against a storage that refuses big rows.
 *
 * Behavioural rather than source-level: the fake rejects a read past the
 * cursor window the way the phone did, so a regression here is the same
 * welcome screen a user with a long history would see.
 */

const KEY = '@vinha/database/v1';

function load() {
  const fake = createFakeAsyncStorage();
  const largeItem = loadAgainstFake(fake, (requireDist) => requireDist('storage/largeItem.js'));
  return { fake, ...largeItem };
}

function valueOfParts(count) {
  // JSON-shaped, like everything stored this way, and long enough for `count`.
  const body = 'ä'.repeat(STORAGE_CHUNK_CHARS * count - 20);
  return JSON.stringify({ body });
}

function partKeys(fake, key = KEY) {
  return [...fake.rows.keys()].filter((candidate) => candidate.startsWith(`${key}#`)).sort();
}

module.exports = [
  {
    name: 'large items: the fake refuses what the phone refused — one 2.2 MB row cannot be read',
    async run() {
      // Without this the rest proves nothing: a fake that reads anything would
      // pass a writer that never splits.
      const { fake } = load();
      const big = valueOfParts(5);
      assert.ok(Buffer.byteLength(big, 'utf8') > CURSOR_WINDOW_BYTES);
      await fake.setItem(KEY, big);
      await assert.rejects(fake.getItem(KEY), /Row too big to fit into CursorWindow/);
    },
  },
  {
    name: 'large items: a long history is written in parts and reads back whole',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();
      const big = valueOfParts(5);

      await setLargeItem(KEY, big);

      assert.equal(await getLargeItem(KEY), big);
      assert.match(fake.rows.get(KEY), /^vinha-chunks:\d+:\d+$/);
      assert.ok(partKeys(fake).length >= 5);
      for (const key of partKeys(fake)) {
        await assert.doesNotReject(fake.getItem(key), `${key} is too big for the phone to read`);
      }
    },
  },
  {
    name: 'large items: a short value is stored exactly as before, and an old install reads unchanged',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();
      const small = JSON.stringify({ workoutSessions: [{ id: 'a' }] });

      await setLargeItem(KEY, small);
      assert.equal(fake.rows.get(KEY), small, 'a value that fits must not grow a manifest');
      assert.deepEqual(partKeys(fake), []);

      // Written by a build that predates splitting.
      await fake.setItem('@vinha/workout/v1', '{"history":{}}');
      assert.equal(await getLargeItem('@vinha/workout/v1'), '{"history":{}}');
      assert.equal(await getLargeItem('@vinha/nothing'), null);
    },
  },
  {
    name: 'large items: parts a shorter value no longer needs are removed',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();

      await setLargeItem(KEY, valueOfParts(5));
      assert.equal(partKeys(fake).length, 5);
      const three = valueOfParts(3);
      await setLargeItem(KEY, three);
      assert.equal(await getLargeItem(KEY), three);
      assert.deepEqual(partKeys(fake), [`${KEY}#0`, `${KEY}#1`, `${KEY}#2`], 'parts past the new end are still on disk');

      const small = '{"workoutSessions":[]}';
      await setLargeItem(KEY, small);
      assert.equal(await getLargeItem(KEY), small);
      assert.deepEqual(partKeys(fake), []);
    },
  },
  {
    name: 'large items: a write that fails leaves the previous value whole',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();
      const before = valueOfParts(4);
      await setLargeItem(KEY, before);

      fake.faults.multiSet = 1;
      await assert.rejects(setLargeItem(KEY, valueOfParts(6)), /disk is full/);

      assert.equal(await getLargeItem(KEY), before);
    },
  },
  {
    name: 'large items: writes and reads fired together still land in order',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();
      const long = valueOfParts(6);
      const short = '{"short":true}';
      const middle = valueOfParts(3);

      // Nothing awaited between them — the way a save and a reload can overlap.
      const writes = [setLargeItem(KEY, long), setLargeItem(KEY, short)];
      const readBetween = getLargeItem(KEY);
      writes.push(setLargeItem(KEY, middle));
      await Promise.all(writes);

      assert.equal(await readBetween, short, 'a read between two writes saw neither whole value');
      assert.equal(await getLargeItem(KEY), middle);
    },
  },
  {
    name: 'large items: a missing part is an error, never a shorter history',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();
      await setLargeItem(KEY, valueOfParts(4));
      fake.rows.delete(`${KEY}#2`);

      await assert.rejects(getLargeItem(KEY), /missing parts/);
    },
  },
  {
    name: 'large items: a failed sweep does not report a finished write as failed',
    async run() {
      const { fake, getLargeItem, setLargeItem } = load();
      const value = valueOfParts(3);
      fake.faults.getAllKeys = 1;
      const warn = console.warn;
      console.warn = () => {};
      try {
        await setLargeItem(KEY, value);
      } finally {
        console.warn = warn;
      }
      assert.equal(await getLargeItem(KEY), value);
    },
  },
  {
    name: 'large items: removing a value removes every part of it',
    async run() {
      const { fake, getLargeItem, removeLargeItem, setLargeItem } = load();
      await setLargeItem(KEY, valueOfParts(4));
      await setLargeItem('@vinha/workout/v1', valueOfParts(2));

      await removeLargeItem(KEY);

      assert.equal(await getLargeItem(KEY), null);
      assert.deepEqual(partKeys(fake), []);
      assert.ok(partKeys(fake, '@vinha/workout/v1').length > 0, 'another key lost its parts');
    },
  },
];
