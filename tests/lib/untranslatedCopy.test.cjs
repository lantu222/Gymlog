const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * No screen or component may print an English word straight into JSX.
 *
 * The i18n suite next door proves every key has a Finnish translation. It says
 * nothing about copy that never became a key — and that is the shape the last
 * of these took: `<Text>Filters</Text>` in the library browser and seven more in
 * the exercise info sheet, sitting in a file that already imported `t` and
 * already had the language in scope. Both are reachable from the Programs tab,
 * so a Finnish reader hit them in normal use.
 *
 * Only text between JSX tags is checked. It is where the copy is, and widening
 * it to every string literal drowns the signal in style values and ids.
 */

const ROOT = path.join(__dirname, '..', '..');
const DIRECTORIES = [path.join(ROOT, 'src', 'screens'), path.join(ROOT, 'src', 'components')];

/** Words that are the same in both languages, so a key would be theatre. */
const ALLOWED = new Set(['Vinha AI', 'Vinha Pro', 'Vinha']);

// >Word Word< — capitalised, at least four characters, no braces or tags. An
// interpolation, a number or a punctuation run is not copy.
const JSX_TEXT = />([A-Z][a-zA-Z',!?.\- ]{3,60})</g;

function collect() {
  const found = [];
  for (const directory of DIRECTORIES) {
    for (const name of fs.readdirSync(directory)) {
      if (!name.endsWith('.tsx')) {
        continue;
      }
      const source = fs.readFileSync(path.join(directory, name), 'utf8');
      for (const [, text] of source.matchAll(JSX_TEXT)) {
        const copy = text.trim();
        if (copy && !ALLOWED.has(copy)) {
          found.push(`${name}: "${copy}"`);
        }
      }
    }
  }
  return found;
}

module.exports = [
  {
    name: 'no screen or component prints English copy instead of a translation key',
    run() {
      assert.deepEqual(
        collect(),
        [],
        'These render literal copy. Add a key to src/lib/i18n.ts and call t(language, key):\n  ' +
          collect().join('\n  '),
      );
    },
  },
];
