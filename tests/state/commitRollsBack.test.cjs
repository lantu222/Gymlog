const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { t } = require('../../.test-dist/lib/i18n.js');

/**
 * A write the disk refuses does not stay in memory.
 *
 * `commit` used to move memory forward and never back. A failed save left the
 * new state on screen with nothing behind it: the finish screen showed its
 * error, the reader pressed Finish again, and the retry found the session
 * already "saved" in memory, reported success and wrote nothing (bug hunt
 * 2026-09-14). Source-level, like the sibling suite: commit lives inside the
 * React provider.
 */

const read = (...parts) =>
  fs
    .readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

function functionBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `${signature} is gone`);
  const ends = ['\n  function ', '\n  async function ']
    .map((marker) => source.indexOf(marker, start + signature.length))
    .filter((index) => index > 0);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

module.exports = [
  {
    name: 'commitRollsBack: a commit whose write fails puts the previous database back and rethrows',
    run() {
      const commit = functionBody(read('src', 'state', 'AppProvider.tsx'), 'async function commit(nextDatabase: AppDatabase)');
      const snapshot = commit.indexOf('const previous = databaseRef.current;');
      const swap = commit.indexOf('databaseRef.current = nextDatabase;');
      assert.ok(snapshot >= 0 && snapshot < swap, 'the previous database is not held before memory moves');

      const tryAt = commit.indexOf('try {');
      assert.ok(tryAt > swap && tryAt < commit.indexOf('await saveDatabase(nextDatabase);'), 'the write is outside the try');
      assert.ok(commit.indexOf('await savePreferences(nextDatabase.preferences);') > tryAt, 'the preferences write is outside the try');
      assert.match(
        commit,
        /catch \(error\) \{\s*databaseRef\.current = previous;\s*setDatabase\(previous\);\s*throw error;\s*\}/,
        'a failed write leaves the new state in memory, or is swallowed',
      );
    },
  },
  {
    name: 'commitRollsBack: a preference the disk refused is not left switched on',
    run() {
      const update = functionBody(read('src', 'state', 'AppProvider.tsx'), 'function updatePreferences(patch: Partial<AppPreferences>)');
      assert.match(
        update,
        /try \{\s*await savePreferences\(next\.preferences\);\s*\} catch \(error\) \{\s*databaseRef\.current = current;\s*setDatabase\(current\);\s*throw error;\s*\}/,
      );
    },
  },
  {
    name: 'commitRollsBack: a Hevy import whose write fails says so and keeps the sheet open',
    run() {
      const app = read('App.tsx');
      const handler = app.slice(app.indexOf('onImportHistory={async (preview) => {'), app.indexOf('onImportHistory={async (preview) => {') + 900);
      assert.match(handler, /try \{\s*result = await importWorkoutHistory\(preview\.workouts\);\s*\} catch \(error\) \{[\s\S]*?showToast\(t\(preferences\.appLanguage, 'hevy\.failed'\)\);\s*return;/);
      assert.ok(handler.indexOf('setSettingsImportVisible(false)') > handler.indexOf('return;'), 'the sheet closes on a failed import');
      assert.equal(t('fi', 'hevy.failed'), 'Tuotuja treenejä ei voitu tallentaa — mitään ei tuotu');
      assert.match(t('en', 'hevy.failed'), /nothing was imported/);
    },
  },
];
