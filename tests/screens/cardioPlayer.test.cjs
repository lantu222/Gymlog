const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'CardioScreen.tsx'),
  'utf8',
);

/**
 * The cardio player's controls, from #bugs 2026-08-26: "lopeta nappi pausen
 * viereen ja oikealla väriteemalla", "hylkää punaisella ja peruuta nappi vähän
 * ylemmäksi".
 */
module.exports = [
  {
    name: 'cardio: ending sits beside pause, not in the corner where you close things',
    run() {
      // The only way to end was the X in the top bar — so the control that
      // SAVES the session looked like the one that throws it away.
      assert.match(source, /styles\.playerControls/);
      assert.match(source, /<Pressable onPress=\{onExit\} style=\{styles\.endBtn\}/);
      assert.match(source, /t\(language, 'cardio\.end'\)/);
      // Smaller than pause: pause is pressed many times a session, ending once.
      const endBtn = source.slice(source.indexOf('endBtn: {'), source.indexOf('pauseBtn: {'));
      assert.match(endBtn, /backgroundColor: theme\.highlight/);
      assert.match(endBtn, /width: 60/);
    },
  },
  {
    name: 'cardio: the safe way out is above the destructive one, and it is red',
    run() {
      const sheet = source.slice(source.indexOf("'cardio.endTitle'"), source.indexOf("'cardio.conflictTitle'"));
      const cancelAt = sheet.indexOf("'common.cancel'");
      const discardAt = sheet.indexOf("'cardio.discard'");
      assert.ok(cancelAt !== -1 && discardAt !== -1);
      // Both were neutral ghosts stacked in a column, so the safe answer sat
      // under the destructive one at the very bottom edge of the screen.
      assert.ok(cancelAt < discardAt, 'cancel belongs above discard');
      assert.match(sheet, /label=\{t\(language, 'cardio\.discard'\)\}\s*\n\s*tone="danger"/);
      assert.match(source, /tone === 'danger' \? theme\.danger : theme\.ink/);
    },
  },
  {
    name: 'cardio: the sheet clears the phone buttons and the fills carry their own ink',
    run() {
      assert.match(source, /useSafeAreaInsets/);
      assert.match(source, /styles\.sheet, \{ paddingBottom: insets\.bottom \+ 30 \}/);

      // `highlight` is purple on the light theme and orange on the dark one, so
      // white reads on only one of them. Green was in neither.
      assert.match(source, /color=\{theme\.highlight\}\s*\n\s*textColor=\{theme\.onHighlight\}/);
      assert.doesNotMatch(source, /color=\{theme\.green\}/);

      // The screen was painted in hardcoded lavender borders that could not
      // follow the dark theme.
      for (const literal of ['#E4DBF5', '#E4D8FF']) {
        assert.ok(!source.includes(literal), `${literal} cannot follow the theme`);
      }
    },
  },
];
