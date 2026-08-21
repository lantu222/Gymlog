const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * Swapping a lift, from the two screens you are actually on when you need to.
 *
 * The sheet offered the programme's substitution group and nothing else, and
 * the button that opened it hid itself when that group was empty — which is
 * exactly the moment a reader wants it, standing at a machine somebody else is
 * using. Reported 2026-08-21: "ei tässäkään voi vaihtaa liikettä".
 */
module.exports = [
  {
    name: 'guided swap: the button never hides itself',
    run() {
      // An empty group is a reason to search the library, not a reason to take
      // the button away.
      assert.doesNotMatch(playerSource, /onSwapExercise=\{swapOptions\.length \?/);
      assert.match(playerSource, /onSwapExercise=\{\(\) => setSwapOpen\(true\)\}/);
      // And the prop is required, so a future screen cannot pass null back in.
      assert.match(playerSource, /onSwapExercise: \(\) => void;/);
    },
  },
  {
    name: 'guided swap: the rest screen can swap too',
    run() {
      // A rest only ever falls between sets of one exercise, so the lift it
      // belongs to is unambiguous — and resting is when you notice the machine
      // is gone.
      assert.match(
        playerSource,
        /step\.type === 'set' \|\| step\.type === 'position' \|\| step\.type === 'rest'/,
      );
      assert.match(playerSource, /label=\{t\(language, 'guided\.swap\.action'\)\}/);
    },
  },
  {
    name: 'guided swap: search, then suggestions, then the whole library',
    run() {
      assert.match(playerSource, /'guided\.swap\.search'/);
      assert.match(playerSource, /'guided\.swap\.suggested'/);
      assert.match(playerSource, /'guided\.swap\.library'/);
      // The library list is derived and capped: 873 rows inside a sheet is a
      // scroll, not a choice.
      assert.match(playerSource, /const swapLibrary = useMemo/);
      assert.match(playerSource, /\.slice\(0, 25\)/);
      assert.match(playerSource, /\.slice\(0, 40\)/);
      // And an empty search says so rather than drawing nothing.
      assert.match(playerSource, /'guided\.swap\.noMatch'/);
    },
  },
  {
    name: 'guided swap: every new string reads in both languages',
    run() {
      for (const key of [
        'guided.swap.action',
        'guided.swap.search',
        'guided.swap.suggested',
        'guided.swap.library',
        'guided.swap.noMatch',
      ]) {
        const occurrences = i18nSource.split(`'${key}':`).length - 1;
        assert.equal(occurrences, 2, `${key} is missing one of its two languages`);
      }
    },
  },
];
