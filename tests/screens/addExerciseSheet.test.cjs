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
      /**
       * The bar's height comes IN as a prop; it cannot be read here.
       *
       * This guard used to pin `insets.bottom + spacing.lg` inside the sheet,
       * which is what shipped on 26.8 — and the button was still half under
       * the system buttons two days later (#bugs 2026-08-28). A Modal is its
       * own native window, and inside one this app gets zero for the bottom
       * inset from the root provider, from a provider added inside the modal,
       * and from `initialWindowMetrics` alike; all three were tried on the
       * emulator with three-button navigation. The screen that opens the sheet
       * is outside the modal, where the same hook is right.
       */
      assert.match(sheet, /bottomInset\?: number;/);
      assert.match(sheet, /styles\.footer, \{ paddingBottom: bottomInset \+ spacing\.lg \}/);
      assert.ok(
        !/useSafeAreaInsets/.test(sheet),
        'reading the inset inside the modal is the bug this guard exists for',
      );
      // And every screen that opens one hands the number over.
      for (const screen of [
        'src/screens/ProgramDayScreen.tsx',
        'src/screens/CreateTemplateScreen.tsx',
        'src/screens/WorkoutEditorScreen.tsx',
      ]) {
        assert.match(read(screen), /bottomInset=\{\w+\.bottom\}/, `${screen} should pass the inset`);
      }
      // The free workout has its own copy of this sheet, with the same bug.
      const empty = read('src/screens/EmptyWorkoutScreen.tsx');
      assert.match(empty, /styles\.sheetFooter, \{ paddingBottom: bottomInset \+ 16 \}/);
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
    name: 'add-exercise sheet: the popular cards wrap two per row instead of sharing one',
    run() {
      const sheet = read('src/components/AddExerciseSheet.tsx');

      // "4 korttia näkyy samaan aikaan todella kapeasti, tekstit ovat tyyliin 3
      // kirjainta ja sitten katkeaa" (user 2026-08-26). The featured card
      // inherited `flex: 1` from gridCard, and `flex: 1` means `flexBasis: 0` —
      // a child with no base width never makes the line overflow, so flexWrap
      // had nothing to trigger on. On a 328px row: four cards at 70px each,
      // which leaves ~54px for a 16px bold title.
      const featured = sheet.slice(sheet.indexOf('featuredCard: {'), sheet.indexOf('gridRow: {'));
      assert.match(featured, /flexBasis: '47%'/);
      assert.match(featured, /flexGrow: 1/);
      assert.doesNotMatch(featured, /flex: 1/);

      // 47 rather than 48 because the gap counts: two 48% cards plus a 16dp gap
      // overflow the row and wrap to one per line — the opposite failure.
      assert.match(sheet, /featuredGrid: \{[\s\S]{0,140}gap: spacing\.md/);
    },
  },
  {
    /**
     * The circle keeps its colour and changes its job.
     *
     * It was a "+" that dropped the lift straight into a workout from a row
     * that is a name and three words — adding blind — and it came out
     * entirely (#38). It is back as an eye that opens the exercise, which is
     * what the library is for (user 2026-08-31).
     */
    name: 'library browser: the circle is an eye, in the app\'s own pressable colour',
    run() {
      const browser = read('src/components/ExerciseLibraryBrowser.tsx');
      // A green circle in a purple-and-orange app was the loudest wrong note on
      // the page. Orange is the app's "you can press this".
      assert.doesNotMatch(browser, /lookButton: \{[\s\S]{0,200}theme\.green\b/);
      assert.match(browser, /backgroundColor: theme\.highlight/);
      // And the glyph takes the ink that orange was paired with, not white.
      assert.match(browser, /<EyeIcon color=\{theme\.onHighlight\} \/>/);

      // It opens; it does not add. The prop that carried "add to workout" is
      // gone from the browser and from the screen that wraps it, so there is
      // nothing left to wire it back to by accident.
      assert.doesNotMatch(browser, /onAddToWorkout/);
      assert.doesNotMatch(browser, /PlusIcon/);
      assert.doesNotMatch(read('src/screens/ExercisesScreen.tsx'), /onAddToWorkout/);
      assert.match(browser, /<LookButton label=\{t\(language, 'library\.a11y\.look'/);
    },
  },
];
