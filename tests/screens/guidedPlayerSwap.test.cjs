const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const playerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'src', 'screens', 'GuidedPlayerScreen.tsx'),
  'utf8',
);
const i18nSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'i18n.ts'), 'utf8');

/**
 * Swapping a lift lives behind the set screen's dots menu — and only there.
 *
 * This has moved twice, both times on the user's word. 2026-08-21: "ei
 * tässäkään voi vaihtaa liikettä" — swap buttons grew on the set screen and
 * the rest screen, ungated. 2026-08-23, after a second tester's round: a set
 * screen is for logging reps and weight, so everything else — swap included —
 * goes behind the three dots ("3 pisteen taakse siirtyy kaikki liikkeiden
 * vaihto"), and the rest screen's swap button goes away ("Poista vaihda liike
 * tästä ruudusta"). What must survive the move: the row never hides itself,
 * and the sheet still searches the whole library.
 */
module.exports = [
  {
    name: 'guided swap: reachable from the actions sheet, never gated',
    run() {
      // The sheet's swap row must not hide when the substitution group is
      // empty — an empty group is a reason to search the library.
      assert.doesNotMatch(playerSource, /swapOptions\.length \?/);
      assert.match(playerSource, /label=\{t\(language, 'guided\.action\.swap'\)\}/);
    },
  },
  {
    name: 'guided swap: no dedicated buttons on the set or rest screens',
    run() {
      // The set screen's own controls are pause and the menu; swap rides
      // behind the menu rather than as a fourth button.
      assert.doesNotMatch(playerSource, /onSwapExercise/);
      // The rest screen lost its swap button (2026-08-23); its old label is
      // gone from the app entirely.
      assert.doesNotMatch(playerSource, /'guided\.swap\.action'/);
      assert.doesNotMatch(i18nSource, /'guided\.swap\.action'/);
      // But the actions sheet still resolves the lift a rest belongs to, so
      // swapping mid-rest stays possible through the menu.
      assert.match(
        playerSource,
        /step\.type === 'set' \|\| step\.type === 'position' \|\| step\.type === 'rest'/,
      );
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
