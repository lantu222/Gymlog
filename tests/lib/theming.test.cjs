const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { lightTheme } = require('../../.test-dist/theming.js');
const { HG } = require('../../.test-dist/lightTheme.js');

const root = path.join(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

module.exports = [
  {
    name: 'theming: the light theme is the palette, not a copy of it',
    run() {
      // A copy would drift the moment someone edits one and not the other —
      // which is exactly how nine screens ended up with a stale background.
      assert.equal(lightTheme, HG, 'lightTheme must be the same object as HG');
    },
  },
  {
    name: 'theming: every Theme token exists in the palette and vice versa',
    run() {
      // The Theme interface is what components read. If the palette grows a
      // token the interface does not declare, the first component to want it
      // has to reach around the theme — and that is how a second source of
      // truth starts.
      const source = read('src/theming.ts');
      const body = /export interface Theme \{([\s\S]*?)\n\}/.exec(source);
      assert.ok(body, 'Theme interface not found');

      const declared = [...body[1].matchAll(/^\s*(\w+):\s*string;/gm)].map((match) => match[1]).sort();
      const palette = Object.keys(HG).sort();

      assert.deepEqual(declared, palette);
    },
  },
  {
    name: 'theming: nothing claims a theme can be chosen yet',
    run() {
      // The dark values, the switch and the preference are phase 3. Until then
      // the provider serves one theme and the app must not offer a choice —
      // this repo has spent two rounds deleting controls that did nothing.
      const source = read('src/theming.ts');
      assert.doesNotMatch(source, /darkTheme/);
      assert.doesNotMatch(source, /useState|setTheme|mode/);

      // The vestigial preference is gone too: it was typed as the single value
      // 'dark', stored 'dark', and read by nothing.
      const models = read('src/types/models.ts');
      assert.doesNotMatch(models, /ThemePreference/);
    },
  },
  {
    name: 'theming: style factories are built per theme, not per render',
    run() {
      const source = read('src/theming.ts');
      assert.match(source, /WeakMap/, 'styles should be cached per factory');
      assert.match(source, /useMemo/);
    },
  },
];
