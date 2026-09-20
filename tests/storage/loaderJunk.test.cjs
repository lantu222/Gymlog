const assert = require('node:assert/strict');
const path = require('node:path');

const { createFakeAsyncStorage, loadAgainstFake } = require('./fakeAsyncStorage.cjs');

const DIST = path.join(__dirname, '..', '..', '.test-dist');

function loadNormalize() {
  const fake = createFakeAsyncStorage();
  return loadAgainstFake(fake, () => require(path.join(DIST, 'storage', 'database.js'))).normalizeDatabase;
}

/**
 * The loader is the one reader that must not trust what it reads.
 *
 * CLAUDE.md: "src/storage/database.ts normalizes on load ... a new field that
 * skips it is a crash on someone's old install." Two gaps found by handing
 * normalizeDatabase junk (2026-09-20). A throw here is worse than a crash:
 * loadDatabase catches it, sets the whole blob aside as corrupt and opens on
 * an empty database — every workout gone from the app over one bad field.
 */
module.exports = [
  {
    name: 'loader: preferences stored as null load as the defaults, not as a corrupt install',
    run() {
      const normalizeDatabase = loadNormalize();
      const out = normalizeDatabase({
        preferences: null,
        workoutSessions: [{ id: 's1', performedAt: '2026-09-20T10:00:00.000Z' }],
      });
      assert.equal(out.preferences.appLanguage, 'en');
      assert.equal(out.workoutSessions.length, 1, 'the history survives a null preferences key');
    },
  },
  {
    name: 'loader: a session entry that is not an object with an id is dropped, not dated today',
    run() {
      const normalizeDatabase = loadNormalize();
      const out = normalizeDatabase({
        workoutSessions: [
          null,
          5,
          {},
          { id: '', performedAt: '2026-09-01T10:00:00.000Z' },
          { id: 'real', performedAt: '2026-09-20T10:00:00.000Z', workoutNameSnapshot: 'Lower A' },
        ],
      });
      assert.deepEqual(
        out.workoutSessions.map((session) => session.id),
        ['real'],
        'junk became sessions called "Workout", dated now',
      );
    },
  },
];
