const assert = require('node:assert/strict');
const path = require('node:path');

const { requireWithStubs } = require('../../helpers/hookHarness.cjs');
const { createFakeAsyncStorage } = require('../../storage/fakeAsyncStorage.cjs');

const STORE = path.join(__dirname, '..', '..', '..', '.test-dist', 'features', 'account', 'accountStore.js');
const KEY = '@vinha/account/signedout/v1';

/**
 * The real store behind "whose data is on this phone", against in-memory
 * AsyncStorage. The hook suite stubs it, so its reading of old and broken
 * rows was run nowhere (review of the invariant fix, 2026-09-28).
 */
function load() {
  const fake = createFakeAsyncStorage();
  const store = requireWithStubs(STORE, {
    '@react-native-async-storage/async-storage': { __esModule: true, default: fake },
  });
  return { fake, store };
}

module.exports = [
  {
    name: 'signed-out accounts: each sign-out is added once, and forgetting clears them all',
    async run() {
      const { fake, store } = load();
      assert.deepEqual(await store.loadSignedOutAccounts(), []);
      await store.rememberSignedOutAccount('a');
      await store.rememberSignedOutAccount('b');
      await store.rememberSignedOutAccount('a');
      assert.deepEqual(await store.loadSignedOutAccounts(), ['a', 'b']);
      await store.forgetSignedOutAccount();
      assert.deepEqual(await store.loadSignedOutAccounts(), []);
      assert.equal(fake.rows.has(KEY), false);
    },
  },
  {
    // The same day's earlier build stored one bare identifier.
    name: 'signed-out accounts: a bare identifier from the earlier build reads as one account, and the next sign-out adds to it',
    async run() {
      const { fake, store } = load();
      fake.rows.set(KEY, 'sub-old');
      assert.deepEqual(await store.loadSignedOutAccounts(), ['sub-old']);
      await store.rememberSignedOutAccount('sub-new');
      assert.deepEqual(await store.loadSignedOutAccounts(), ['sub-old', 'sub-new']);
    },
  },
  {
    name: 'signed-out accounts: a broken row reads as none rather than throwing, and junk entries are dropped',
    async run() {
      const { fake, store } = load();
      fake.rows.set(KEY, '[not json');
      assert.deepEqual(await store.loadSignedOutAccounts(), []);
      fake.rows.set(KEY, JSON.stringify(['a', 3, null, '', 'b']));
      assert.deepEqual(await store.loadSignedOutAccounts(), ['a', 'b']);
      fake.rows.set(KEY, JSON.stringify({ a: 1 }));
      assert.deepEqual(await store.loadSignedOutAccounts(), []);
    },
  },
];
