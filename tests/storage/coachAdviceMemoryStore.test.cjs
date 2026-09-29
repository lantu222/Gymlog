const assert = require('node:assert/strict');

const { createFakeAsyncStorage, loadAgainstFake } = require('./fakeAsyncStorage.cjs');

/**
 * The coach memory store's own erase, against a storage that refuses some of
 * its writes — the same failures useAccountBackup's onRestored can meet
 * after a restore has already landed both other stores (recheck round,
 * 2026-09-29). The restore itself cannot roll back at that point, so a
 * refused erase has to be retried and, failing that, remembered for the next
 * launch rather than swallowed.
 */

const MEMORY_KEY = '@vinha/coach/memory/v1';
const PENDING_KEY = '@vinha/coach/memory/pendingerase/v1';

function load() {
  const fake = createFakeAsyncStorage();
  const store = loadAgainstFake(fake, (requireDist) => requireDist('storage/coachAdviceMemoryStore.js'));
  return { fake, ...store };
}

/** Makes `fake.removeItem` on `key` throw for the next `times` calls, then behave as before. */
function failRemoveItem(fake, key, times) {
  const original = fake.removeItem.bind(fake);
  let remaining = times;
  fake.removeItem = async (candidateKey) => {
    if (remaining > 0 && candidateKey === key) {
      remaining -= 1;
      throw new Error('database or disk is full');
    }
    return original(candidateKey);
  };
}

module.exports = [
  {
    name: 'coach memory store: an erase retries once before giving up, and a landed retry leaves no pending flag',
    async run() {
      const { fake, saveCoachAdviceMemory, clearCoachAdviceMemory } = load();
      await saveCoachAdviceMemory([{ takeaway: 'add 2.5 kg next time', at: '2026-09-01T00:00:00.000Z' }]);
      failRemoveItem(fake, MEMORY_KEY, 1);

      await clearCoachAdviceMemory();

      assert.equal(fake.rows.has(MEMORY_KEY), false, 'the retry never landed the erase');
      assert.equal(fake.rows.has(PENDING_KEY), false, 'a landed erase left a pending flag standing');
    },
  },
  {
    // Both attempts fail — the same as an account restore's own cleanup
    // meeting a disk that stays full past one retry. The restore has already
    // committed the other account's database and history; this must not
    // throw the loss away, only remember it.
    name: 'coach memory store: an erase that fails twice marks a pending flag, and the next load finishes it before the coach reads anything',
    async run() {
      const { fake, saveCoachAdviceMemory, clearCoachAdviceMemory, loadCoachAdviceMemory } = load();
      await saveCoachAdviceMemory([{ takeaway: "another account's tip", at: '2026-09-01T00:00:00.000Z' }]);
      failRemoveItem(fake, MEMORY_KEY, 2);

      await clearCoachAdviceMemory();

      assert.equal(fake.rows.has(MEMORY_KEY), true, 'two failed attempts should still leave the memory on disk');
      assert.equal(fake.rows.get(PENDING_KEY), '1', 'two failed attempts should mark the pending flag');

      // The next launch's load — the one place the coach reads this file —
      // finishes what the restore's own cleanup could not.
      const loaded = await loadCoachAdviceMemory();
      assert.deepEqual(loaded, [], 'a pending erase must be finished, not read, by the next load');
      assert.equal(fake.rows.has(MEMORY_KEY), false, 'the load did not finish the pending erase');
      assert.equal(fake.rows.has(PENDING_KEY), false, 'the pending flag should be cleared once the erase is finished');
    },
  },
  {
    // Recheck round, 2026-09-29: a failed erase leaves the pending flag set,
    // and finishPendingErase used to delete STORAGE_KEY unconditionally
    // whenever that flag was still up — with no way to tell "the stale
    // memory the erase was meant to reach" apart from "a legitimate write
    // that landed afterward". A restore (or reset) whose own erase failed
    // twice, followed in the same session by the reader chatting with the
    // coach under the new account, wrote fresh memory that the very next
    // launch then destroyed.
    name: 'coach memory store: a legitimate save after a failed erase survives the next load',
    async run() {
      const { fake, saveCoachAdviceMemory, clearCoachAdviceMemory, loadCoachAdviceMemory } = load();
      await saveCoachAdviceMemory([{ takeaway: "old account's tip", at: '2026-09-01T00:00:00.000Z' }]);
      failRemoveItem(fake, MEMORY_KEY, 2);

      // The old account's erase fails twice and is left pending.
      await clearCoachAdviceMemory();
      assert.equal(fake.rows.get(PENDING_KEY), '1', 'the failed erase should mark the pending flag');

      // In the same session, the reader chats with the coach under the new
      // (post-restore) account, and its answer is saved for real.
      await saveCoachAdviceMemory([{ takeaway: "new account's real tip", at: '2026-09-02T00:00:00.000Z' }]);
      assert.equal(fake.rows.has(PENDING_KEY), false, 'a fresh save should clear a pending erase it supersedes');

      // The next launch must load exactly the new account's memory, not [].
      const loaded = await loadCoachAdviceMemory();
      assert.deepEqual(
        loaded.map((entry) => entry.takeaway),
        ["new account's real tip"],
        'a finished pending erase destroyed a legitimate write that landed after it was queued',
      );
    },
  },
  {
    // The write itself can still fail (e.g. the disk is still full) — in
    // that case nothing changed, so the pending flag from the earlier erase
    // must still stand for the next load to finish.
    name: 'coach memory store: a save that itself fails does not clear a pending erase',
    async run() {
      const { fake, saveCoachAdviceMemory, clearCoachAdviceMemory } = load();
      await saveCoachAdviceMemory([{ takeaway: "old account's tip", at: '2026-09-01T00:00:00.000Z' }]);
      failRemoveItem(fake, MEMORY_KEY, 2);
      await clearCoachAdviceMemory();
      assert.equal(fake.rows.get(PENDING_KEY), '1');

      const originalSetItem = fake.setItem.bind(fake);
      fake.setItem = async () => {
        throw new Error('database or disk is full');
      };
      await saveCoachAdviceMemory([{ takeaway: "new account's tip", at: '2026-09-02T00:00:00.000Z' }]);
      fake.setItem = originalSetItem;

      assert.equal(fake.rows.get(PENDING_KEY), '1', 'a failed write must not clear the pending erase it never earned');
    },
  },
  {
    name: 'coach memory store: a load with nothing pending still reads the memory it always did',
    async run() {
      const { saveCoachAdviceMemory, loadCoachAdviceMemory } = load();
      await saveCoachAdviceMemory([{ takeaway: 'keep training the same lift', at: '2026-09-01T00:00:00.000Z' }]);

      const loaded = await loadCoachAdviceMemory();

      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].takeaway, 'keep training the same lift');
    },
  },
];
