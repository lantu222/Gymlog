const path = require('node:path');

/**
 * AsyncStorage as Android's legacy SQLite backend behaves, in memory.
 *
 * Two behaviours matter and both are copied from the phone rather than
 * imagined:
 *
 * - A read of a row bigger than the 2 MB cursor window rejects with the same
 *   message the emulator logged on 2026-09-14. The write before it succeeds.
 * - `multiSet` is one transaction: every pair lands or none does.
 *
 * Every call yields once before it runs, so calls made without awaiting still
 * execute in the order they were made, the way the native serial executor
 * runs them.
 */
const CURSOR_WINDOW_BYTES = 2 * 1024 * 1024;

function createFakeAsyncStorage() {
  const rows = new Map();
  const faults = { multiSet: 0, getAllKeys: 0 };

  const tick = () => Promise.resolve();

  const storage = {
    rows,
    faults,
    async getItem(key) {
      await tick();
      if (!rows.has(key)) {
        return null;
      }
      const value = rows.get(key);
      if (Buffer.byteLength(key, 'utf8') + Buffer.byteLength(value, 'utf8') > CURSOR_WINDOW_BYTES) {
        throw new Error('Row too big to fit into CursorWindow requiredPos=0, totalRows=1');
      }
      return value;
    },
    async setItem(key, value) {
      await tick();
      rows.set(key, String(value));
    },
    async removeItem(key) {
      await tick();
      rows.delete(key);
    },
    async multiSet(pairs) {
      await tick();
      if (faults.multiSet > 0) {
        faults.multiSet -= 1;
        throw new Error('database or disk is full');
      }
      for (const [key, value] of pairs) {
        rows.set(key, String(value));
      }
    },
    async multiRemove(keys) {
      await tick();
      for (const key of keys) {
        rows.delete(key);
      }
    },
    async getAllKeys() {
      await tick();
      if (faults.getAllKeys > 0) {
        faults.getAllKeys -= 1;
        throw new Error('getAllKeys failed');
      }
      return [...rows.keys()];
    },
  };
  return storage;
}

const DIST = path.join(__dirname, '..', '..', '.test-dist');

/** Modules that capture AsyncStorage when required, so they load fresh per fake. */
const STORAGE_MODULES = [
  'storage/largeItem.js',
  'storage/coachAdviceMemoryStore.js',
  'storage/deviceLocale.js',
  'storage/database.js',
  'features/workout/workoutPersistence.js',
];

/**
 * Require compiled storage modules against `fake`.
 *
 * The stubs sit in the require cache only while `load` runs. A module holds on
 * to the AsyncStorage it was given at require time, so the returned exports
 * keep using the fake after the cache is put back, and no other suite sees it.
 *
 * `options.locale` is the tag the phone reports (storage/deviceLocale); left
 * out, the stub reports none and the language falls to Node's own Intl.
 */
function loadAgainstFake(fake, load, options = {}) {
  const from = { paths: [path.join(DIST, 'storage')] };
  const i18nManager = options.locale ? { getConstants: () => ({ localeIdentifier: options.locale }) } : {};
  const stubs = [
    ['@react-native-async-storage/async-storage', { __esModule: true, default: fake }],
    ['react-native', { I18nManager: i18nManager, NativeModules: {}, Platform: { OS: 'android' } }],
  ];
  const saved = new Map();
  const put = (file, entry) => {
    if (!saved.has(file)) {
      saved.set(file, require.cache[file]);
    }
    if (entry) {
      require.cache[file] = entry;
    } else {
      delete require.cache[file];
    }
  };

  for (const [name, exports] of stubs) {
    const file = require.resolve(name, from);
    put(file, { id: file, filename: file, loaded: true, exports });
  }
  for (const relative of STORAGE_MODULES) {
    put(path.join(DIST, relative), null);
  }

  try {
    return load((relative) => require(path.join(DIST, relative)));
  } finally {
    for (const [file, entry] of saved) {
      if (entry) {
        require.cache[file] = entry;
      } else {
        delete require.cache[file];
      }
    }
  }
}

module.exports = { createFakeAsyncStorage, loadAgainstFake, CURSOR_WINDOW_BYTES };
