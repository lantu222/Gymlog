const assert = require('node:assert/strict');

const { createFakeAsyncStorage, loadAgainstFake } = require('../storage/fakeAsyncStorage.cjs');
const { readAppWiring } = require('../helpers/appWiringSource.cjs');

/**
 * Setup's weight is written once, ever — not whenever the log happens to be
 * empty, which is also what the reader sees the moment they delete their only
 * weigh-in (2026-09-16).
 */

const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

module.exports = [
  {
    name: 'bodyweight seed: an install that already has weigh-ins is loaded as seeded',
    run() {
      const fake = createFakeAsyncStorage();
      const { normalizeDatabase } = loadAgainstFake(fake, (requireDist) => requireDist('storage/database.js'));

      // A fresh install has nothing and has seeded nothing.
      assert.equal(normalizeDatabase({ preferences: {} }).preferences.setupWeightSeeded, false);

      // An install from before the flag existed: its weigh-ins are the proof
      // the one-off write already happened, so it must not run again.
      const older = normalizeDatabase({
        preferences: {},
        bodyweightEntries: [{ id: 'bw1', recordedAt: '2026-09-01T06:00:00.000Z', weight: 82 }],
      });
      assert.equal(older.preferences.setupWeightSeeded, true);

      // And a stored flag is read back as it was written.
      assert.equal(
        normalizeDatabase({ preferences: { setupWeightSeeded: true }, bodyweightEntries: [] }).preferences.setupWeightSeeded,
        true,
      );
      assert.equal(
        normalizeDatabase({ preferences: { setupWeightSeeded: 'yes' } }).preferences.setupWeightSeeded,
        false,
        'a malformed value is not a yes',
      );
    },
  },
  {
    name: 'bodyweight seed: the effect asks the flag, not the empty log',
    run() {
      const wiring = strip(readAppWiring());
      assert.match(
        wiring,
        /if \(preferences\.setupWeightSeeded \|\| database\.bodyweightEntries\.length > 0\) \{/,
      );
      assert.match(
        wiring,
        /void addBodyweightEntry\(preferences\.setupCurrentWeightKg\)\s*\.then\(\(\) => updatePreferences\(\{ setupWeightSeeded: true \}\)\)\s*\.catch\(\(\) => undefined\);/,
      );
      // The old rule, which put a deleted weigh-in straight back.
      assert.doesNotMatch(
        wiring,
        /if \(database\.bodyweightEntries\.length > 0\) \{\s*return;\s*\}\s*void addBodyweightEntry\(preferences\.setupCurrentWeightKg\);/,
      );
    },
  },
];
