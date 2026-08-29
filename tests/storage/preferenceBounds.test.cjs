const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'storage', 'database.ts'),
  'utf8',
);

/**
 * A source guard, like the rest of tests/storage: database.ts imports
 * AsyncStorage, so the module cannot be required in Node and the normaliser
 * has to be read rather than run.
 *
 * CLAUDE.md: "Loaders that trust stored data. src/storage/database.ts
 * normalizes on load; a new field that skips it is a crash on someone's old
 * install." A field can be listed in the normaliser and still be trusted — a
 * bare `typeof x === 'number'` admits NaN, Infinity and negatives.
 */
module.exports = [
  {
    name: 'stored defaultRestSeconds is bounded, not just type-checked',
    run() {
      const branch = source.slice(
        source.indexOf('defaultRestSeconds:'),
        source.indexOf('autoFocusNextInput:'),
      );
      assert.ok(branch.length > 0, 'defaultRestSeconds branch not found');

      // NaN is a number. Left unbounded it reached every rest timer through
      // getExerciseTemplateDefaults and produced a bar frozen at 0:00 that
      // never ended, on a device whose stored value nobody could see.
      assert.match(branch, /Number\.isFinite\(input\.preferences\.defaultRestSeconds\)/);
      assert.match(branch, /input\.preferences\.defaultRestSeconds > 0/);
      assert.match(branch, /Math\.min\(/);
      assert.match(branch, /MAX_DEFAULT_REST_SECONDS/);
      assert.match(source, /const MAX_DEFAULT_REST_SECONDS = \d+;/);

      // The fallback is still the way out, so an unusable value loses to the
      // default rather than to zero.
      assert.match(branch, /: fallback\.preferences\.defaultRestSeconds/);
    },
  },
];
