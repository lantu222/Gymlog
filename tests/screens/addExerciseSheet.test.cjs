const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '../..', relative), 'utf8');

/**
 * The screen a reader meets when they try to put a lift back into a programme.
 *
 * "Tosi sekava sivu... mitään liikkeitä ei voi lisätä kun nappi häviää alas,
 * +ikoni muutenkin sotkee värit aivan pieleen" (#bugs 2026-08-26). Two causes,
 * both structural rather than matters of taste.
 */
module.exports = [
  {
    name: 'add-exercise sheet: the confirm button clears the phone buttons',
    run() {
      const sheet = read('src/components/AddExerciseSheet.tsx');
      // The sheet is anchored to the bottom edge, so a fixed footer padding puts
      // the only button that adds anything behind the system nav bar. Its height
      // is only known at runtime.
      assert.match(sheet, /useSafeAreaInsets/);
      assert.match(sheet, /styles\.footer, \{ paddingBottom: insets\.bottom \+ spacing\.lg \}/);
    },
  },
  {
    name: 'add-exercise sheet: it is painted in tokens, so the dark theme reaches it',
    run() {
      const sheet = read('src/components/AddExerciseSheet.tsx');
      // It was built before the theme engine and never migrated: selected
      // filters, chips and cards were hardcoded #22C55E on #E8F6EC. Off-brand in
      // an app whose language is "orange = pressable, purple = brand", and
      // literals ignore the dark theme entirely — on dark it drew near-white
      // pills.
      for (const literal of ['#22C55E', '#E8F6EC', '#F8FFFA', '#D1D5DB']) {
        assert.ok(!sheet.includes(literal), `${literal} is a literal that cannot follow the theme`);
      }
      // White on a purple fill is the app's existing pairing and reads on both
      // themes, so that one literal stays — everything else is a token.
      const literals = sheet.match(/'#[0-9A-Fa-f]{6}'/g) ?? [];
      assert.deepEqual([...new Set(literals)], ["'#FFFFFF'"]);
    },
  },
  {
    name: 'library browser: the add glyph speaks the app\'s own colour',
    run() {
      const browser = read('src/components/ExerciseLibraryBrowser.tsx');
      // A green circle in a purple-and-orange app was the loudest wrong note on
      // the page. Orange is the app's "you can press this".
      assert.doesNotMatch(browser, /addButton: \{[\s\S]{0,200}theme\.green\b/);
      assert.match(browser, /backgroundColor: theme\.highlight/);
      // And the glyph takes the ink that orange was paired with, not white.
      assert.match(browser, /<PlusIcon color=\{theme\.onHighlight\} \/>/);
    },
  },
];
