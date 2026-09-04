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
  {
    /**
     * Where you are in the workout is a colour, not a size.
     *
     * The rail gave the current exercise the same purple as the finished ones
     * and told them apart by two pixels of height and twice the width — on a
     * 5px bar, read at arm's length between sets (user 2026-09-01).
     *
     * Amber carried that mark until 2026-09-04, when the session flow started
     * using amber for a body part the reader flagged in setup. Two meanings
     * for one colour in one flow is the problem the size difference was: the
     * rail moved to `highlight` for here and `green` for done, which are the
     * same two colours every other screen of the session uses, and amber is
     * now caution and nothing else.
     */
    name: 'guided player: the rail says here and done in the two colours the session uses',
    run() {
      // The bar no longer shares a branch with `done`.
      assert.doesNotMatch(
        playerSource,
        /done \|\| isCurrent \? \(dark \? GPD\.purple : theme\.purple\)/,
        'the current exercise is the same colour as a finished one again',
      );
      // Here / done / ahead, three states in one expression.
      assert.match(
        playerSource,
        /backgroundColor: isCurrent \? theme\.highlight : done \? theme\.green : theme\.faint/,
      );

      // The multi-set pill is the current exercise too, so it wears the same
      // mark: a `highlight` rim, `highlight` on the set being worked, and
      // green on the sets already logged.
      assert.match(playerSource, /borderColor: theme\.highlight/);
      assert.match(playerSource, /dot === dotIndex\s+\? theme\.highlight/);
      assert.match(playerSource, /dot < dotsDone\s+\? theme\.green/);

      // And amber is gone from the rail entirely — including the dark
      // gradient's own palette, which no longer carries one.
      assert.doesNotMatch(playerSource, /GPD\.amber/, 'the rail palette still has an amber to reach for');
    },
  },
];
