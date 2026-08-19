const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * An unreadable database may be replaced, but not thrown away.
 *
 * `loadDatabase` has to hand the app something openable, so a blob that will not
 * parse gets an empty database written over it. That overwrite used to be the
 * end of the story: a truncated write cost the reader every workout they had
 * ever logged, and there was nothing left on the phone to answer a support mail
 * from. The bytes are set aside under their own key first.
 *
 * Source-level, like the seed guard beside it: loadDatabase talks to
 * AsyncStorage, which does not exist in the Node test environment. So this
 * pins the shape of the branch, not its behaviour on a phone.
 */

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'), 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

module.exports = [
  {
    name: 'an unparseable database is set aside before an empty one replaces it',
    run() {
      assert.match(code, /const CORRUPT_STORAGE_KEY = '@vinha\/database\/corrupt'/);

      // The catch that recovers from a failed parse, up to the point where it
      // writes: the quarantine has to happen inside it, before saveDatabase.
      const branch = code.slice(code.indexOf('normalizeDatabase(JSON.parse(raw)'));
      const quarantine = branch.indexOf('setItem(CORRUPT_STORAGE_KEY, raw)');
      const overwrite = branch.indexOf('await saveDatabase(empty)');

      assert.ok(quarantine > 0, 'the corrupt blob is not kept anywhere — the overwrite is final');
      assert.ok(overwrite > 0, 'the corrupt branch no longer writes an empty database');
      assert.ok(quarantine < overwrite, 'the copy is taken after the overwrite, which is no copy at all');
    },
  },
  {
    name: 'erasing the app erases the quarantined copy too',
    run() {
      // Somebody asking for their data to be deleted is not asking for a copy
      // of it to survive under another key.
      const reset = code.slice(code.indexOf('export async function resetDatabase'));
      assert.match(reset, /removeItem\(CORRUPT_STORAGE_KEY\)/);
    },
  },
];
